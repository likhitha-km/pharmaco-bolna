import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config.js';
import { generateUniquePharmacoId } from '../utils/generatePharmacoId.js';

const AuthContext = createContext(null);

function ensureAuthReady() {
  if (!auth || !db) {
    throw new Error('Authentication service is unavailable right now. Please try again later.');
  }
}

function normalizeProfessionalDetails(formData, role) {
  if (role !== 'healthcare_professional') {
    return null;
  }

  return {
    designation: formData.designation || '',
    institution_name: formData.institution_name || '',
    medical_registration_number: formData.medical_registration_number || '',
    specialisation: formData.specialisation || '',
  };
}

function sanitizeUsernameBase(email = '') {
  const prefix = email.split('@')[0] || 'user';
  const normalized = prefix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  return normalized || 'user';
}

async function isUsernameTaken(username) {
  const usersRef = collection(db, 'users');
  const takenQuery = query(usersRef, where('username', '==', username), limit(1));
  const snapshot = await getDocs(takenQuery);
  return !snapshot.empty;
}

async function resolveUniqueUsername(base) {
  let candidate = base;
  let suffix = 1;

  while (await isUsernameTaken(candidate)) {
    const suffixText = String(suffix);
    const maxBase = Math.max(4, 20 - suffixText.length);
    candidate = `${base.slice(0, maxBase)}${suffixText}`;
    suffix += 1;
  }

  return candidate;
}

async function resolveIdentifierToEmail(identifier) {
  const input = (identifier || '').trim();
  const usersRef = collection(db, 'users');

  if (/^phr-/i.test(input)) {
    const pharmacoId = input.toUpperCase();
    const idQuery = query(usersRef, where('pharmaco_id', '==', pharmacoId), limit(1));
    const idSnapshot = await getDocs(idQuery);

    if (idSnapshot.empty) {
      throw new Error('No account found with this Pharmaco ID.');
    }

    return idSnapshot.docs[0].data().email;
  }

  if (!input.includes('@')) {
    const username = input.toLowerCase();
    const usernameQuery = query(usersRef, where('username', '==', username), limit(1));
    const usernameSnapshot = await getDocs(usernameQuery);

    if (usernameSnapshot.empty) {
      throw new Error('No account found with this username.');
    }

    return usernameSnapshot.docs[0].data().email;
  }

  return input;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const signUpWithEmail = async (formData) => {
    ensureAuthReady();
    setAuthError(null);

    const normalizedUsername = (formData.username || '').toLowerCase().trim();
    const usersRef = collection(db, 'users');
    const usernameQuery = query(usersRef, where('username', '==', normalizedUsername), limit(1));
    const usernameSnapshot = await getDocs(usernameQuery);

    if (!usernameSnapshot.empty) {
      throw new Error('This username is already taken.');
    }

    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, formData.email.trim(), formData.password);
    } catch (error) {
      if (error?.code === 'auth/email-already-in-use' || error?.message?.includes('email-already-in-use')) {
        throw new Error('google-account-existing');
      }
      throw error;
    }

    await updateProfile(credential.user, { displayName: formData.full_name });

    const continueUrl = `${window.location.origin}/verify-email`;
    await sendEmailVerification(credential.user, {
      url: continueUrl,
      handleCodeInApp: false,
    });

    const pharmacoId = await generateUniquePharmacoId();
    const role = formData.role;

    const payload = {
      uid: credential.user.uid,
      pharmaco_id: pharmacoId,
      username: normalizedUsername,
      email: formData.email.trim().toLowerCase(),
      full_name: formData.full_name,
      date_of_birth: formData.date_of_birth,
      gender: formData.gender,
      contact_number: formData.contact_number,
      country: formData.country,
      state: formData.state,
      city: formData.city || '',
      role,
      professional_details: normalizeProfessionalDetails(formData, role),
      account_status: 'pending_verification',
      email_verified: false,
      google_account: false,
      profile_incomplete: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      last_login: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', credential.user.uid), payload);
    return { user: credential.user, pharmaco_id: pharmacoId };
  };

  const signInWithGoogle = async (role) => {
    ensureAuthReady();
    setAuthError(null);

    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');

    const credential = await signInWithPopup(auth, provider);
    const signedUser = credential.user;
    const userRef = doc(db, 'users', signedUser.uid);
    const usersRef = collection(db, 'users');
    const existingProfileSnap = await getDoc(userRef);
    const normalizedEmail = (signedUser.email || '').trim().toLowerCase();

    const duplicateGoogleProfilesQuery = query(
      usersRef,
      where('email', '==', normalizedEmail),
      where('google_account', '==', true)
    );
    const duplicateGoogleProfilesSnapshot = await getDocs(duplicateGoogleProfilesQuery);
    const staleGoogleDocs = duplicateGoogleProfilesSnapshot.docs.filter((profileDoc) => profileDoc.id !== signedUser.uid);

    if (staleGoogleDocs.length > 0) {
      await Promise.all(staleGoogleDocs.map((profileDoc) => deleteDoc(doc(db, 'users', profileDoc.id))));
    }

    if (!existingProfileSnap.exists()) {
      const baseUsername = sanitizeUsernameBase(signedUser.email || 'user');
      const username = await resolveUniqueUsername(baseUsername);

      const payload = {
        uid: signedUser.uid,
        pharmaco_id: null,
        username,
        email: normalizedEmail,
        full_name: signedUser.displayName || '',
        date_of_birth: '',
        gender: '',
        contact_number: '',
        country: 'India',
        state: '',
        city: '',
        role: role || 'patient',
        professional_details: null,
        account_status: 'pending_verification',
        email_verified: true,
        google_account: true,
        profile_incomplete: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        last_login: serverTimestamp(),
      };

      await setDoc(userRef, payload);
      return { user: signedUser, pharmaco_id: null, isNewUser: true };
    }

    const profileData = existingProfileSnap.data() || {};

    await setDoc(
      userRef,
      {
        ...profileData,
        full_name: signedUser.displayName || profileData.full_name || '',
        email: normalizedEmail || profileData.email || '',
        email_verified: true,
        google_account: true,
        last_login: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );

    return {
      user: signedUser,
      pharmaco_id: existingProfileSnap.data().pharmaco_id,
      isNewUser: false,
    };
  };

  const loginWithIdentifier = async (identifier, password) => {
    ensureAuthReady();
    setAuthError(null);

    const resolvedEmail = await resolveIdentifierToEmail(identifier);
    const credential = await signInWithEmailAndPassword(auth, resolvedEmail, password);

    await updateDoc(doc(db, 'users', credential.user.uid), {
      last_login: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    return credential.user;
  };

  const resetPassword = async (email) => {
    ensureAuthReady();
    setAuthError(null);

    await sendPasswordResetEmail(auth, email, {
      url: `${window.location.origin}/login`,
      handleCodeInApp: false,
    });

    return true;
  };

  const refreshProfile = async () => {
    if (user && db) {
      const profileRef = doc(db, 'users', user.uid);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        setUserProfile(profileSnap.data());
      }
    }
  };

  const logout = async () => {
    if (!auth) {
      localStorage.removeItem('pharmaco_user_uid');
      localStorage.removeItem('pharmaco_user_email');
      setUser(null);
      setUserProfile(null);
      return;
    }

    await signOut(auth);
    localStorage.removeItem('pharmaco_user_uid');
    localStorage.removeItem('pharmaco_user_email');
    setUser(null);
    setUserProfile(null);
  };

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        localStorage.removeItem('pharmaco_user_uid');
        localStorage.removeItem('pharmaco_user_email');
        setUserProfile(null);
        setLoading(false);
        return;
      }

      localStorage.setItem('pharmaco_user_uid', currentUser.uid);
      localStorage.setItem('pharmaco_user_email', currentUser.email || '');

      try {
        const profileRef = doc(db, 'users', currentUser.uid);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
          setUserProfile(profileSnap.data());
          await setDoc(
            profileRef,
            {
              ...(profileSnap.data() || {}),
              last_login: serverTimestamp(),
              updated_at: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          setUserProfile(null);
        }
      } catch (error) {
        setAuthError(error.message || 'Unable to load profile.');
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, []);

  const value = useMemo(
    () => ({
      user,
      userProfile,
      loading,
      authError,
      setAuthError,
      signUpWithEmail,
      signInWithGoogle,
      loginWithIdentifier,
      resetPassword,
      logout,
      refreshProfile,
    }),
    [user, userProfile, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
