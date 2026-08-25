import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import RoleSelector from '../components/auth/RoleSelector.jsx';
import PharmacoBadge from '../components/auth/PharmacoBadge.jsx';
import { validators } from '../utils/validators.js';
import { generateUniquePharmacoId } from '../utils/generatePharmacoId.js';

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

const DESIGNATIONS = [
  'Doctor (MBBS)',
  'Doctor (MD/MS)',
  'Doctor (PhD)',
  'Pharmacist',
  'Nurse',
  'Physiotherapist',
  'Allied Health Professional',
  'Researcher',
  'Other',
];

async function checkUsernameAvailable(username, uid) {
  if (!db) {
    return true;
  }

  const usersRef = collection(db, 'users');
  const usernameQuery = query(usersRef, where('username', '==', username), limit(1));
  const snapshot = await getDocs(usernameQuery);

  if (snapshot.empty) {
    return true;
  }

  return snapshot.docs[0].id === uid;
}

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { user, userProfile, loading, refreshProfile } = useAuth();
  const userEmail = userProfile?.email || user?.email || '';

  const [form, setForm] = useState({
    username: '',
    full_name: '',
    date_of_birth: '',
    gender: '',
    contact_number: '',
    country: 'India',
    state: '',
    city: '',
    role: 'patient',
    designation: '',
    medical_registration_number: '',
    institution_name: '',
    specialisation: '',
    consent: false,
  });
  const [errors, setErrors] = useState({});
  const [usernameState, setUsernameState] = useState({ checking: false, available: null });
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState('');
  const [createdPharmacoId, setCreatedPharmacoId] = useState(null);

  useEffect(() => {
    if (!userProfile) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      username: userProfile.username || '',
      full_name: userProfile.full_name || user?.displayName || '',
      date_of_birth: userProfile.date_of_birth || '',
      gender: userProfile.gender || '',
      contact_number: userProfile.contact_number || '',
      country: userProfile.country || 'India',
      state: userProfile.state || '',
      city: userProfile.city || '',
      role: userProfile.role || 'patient',
      designation: userProfile.professional_details?.designation || '',
      medical_registration_number: userProfile.professional_details?.medical_registration_number || '',
      institution_name: userProfile.professional_details?.institution_name || '',
      specialisation: userProfile.professional_details?.specialisation || '',
    }));
  }, [userProfile, user]);

  useEffect(() => {
    const normalized = form.username.trim().toLowerCase();
    const formatError = validators.username(normalized);

    if (!normalized || formatError || !user) {
      setUsernameState({ checking: false, available: null });
      return undefined;
    }

    setUsernameState({ checking: true, available: null });
    const timer = setTimeout(async () => {
      const available = await checkUsernameAvailable(normalized, user.uid);
      setUsernameState({ checking: false, available });
    }, 600);

    return () => clearTimeout(timer);
  }, [form.username, user]);

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (!loading && userProfile && !userProfile.profile_incomplete && !createdPharmacoId) {
    return <Navigate to="/dashboard" replace />;
  }

  const isHcp = form.role === 'healthcare_professional';

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = async () => {
    const nextErrors = {};

    nextErrors.username = validators.username(form.username?.trim().toLowerCase());
    nextErrors.full_name = validators.fullName(form.full_name);
    nextErrors.date_of_birth = validators.dateOfBirth(form.date_of_birth);
    nextErrors.gender = !form.gender ? 'Please select your gender.' : null;
    nextErrors.contact_number = validators.contactNumber(form.contact_number);
    nextErrors.country = !form.country.trim() ? 'Country is required.' : null;
    nextErrors.state = !form.state.trim() ? 'State / Province is required.' : null;
    nextErrors.role = !form.role ? 'Please select your role.' : null;
    nextErrors.consent = !form.consent ? 'Consent is required.' : null;

    if (isHcp) {
      nextErrors.designation = !form.designation ? 'Designation is required.' : null;
      nextErrors.medical_registration_number = validators.medicalRegistrationNumber(
        form.medical_registration_number,
        form.role
      );
      nextErrors.institution_name = !form.institution_name.trim() ? 'Institution / Hospital Name is required.' : null;
    }

    if (!nextErrors.username && user) {
      const available = await checkUsernameAvailable(form.username.trim().toLowerCase(), user.uid);
      if (!available) {
        nextErrors.username = 'This username is already taken.';
      }
    }

    const filtered = Object.fromEntries(Object.entries(nextErrors).filter(([, value]) => Boolean(value)));
    setErrors(filtered);
    return Object.keys(filtered).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setApiError('');

    const valid = await validate();
    if (!valid || !user || !db) {
      return;
    }

    setBusy(true);
    try {
      let finalPharmacoId = userProfile?.pharmaco_id;
      if (!finalPharmacoId) {
        finalPharmacoId = await generateUniquePharmacoId();
      }

      await setDoc(
        doc(db, 'users', user.uid),
        {
          pharmaco_id: finalPharmacoId,
          username: form.username.trim().toLowerCase(),
          email: userEmail,
          full_name: form.full_name.trim(),
          date_of_birth: form.date_of_birth,
          gender: form.gender,
          contact_number: form.contact_number.replace(/[\s\-()]/g, ''),
          country: form.country.trim(),
          state: form.state.trim(),
          city: form.city.trim(),
          role: form.role,
          professional_details: isHcp
            ? {
                designation: form.designation,
                institution_name: form.institution_name.trim(),
                medical_registration_number: form.medical_registration_number.trim(),
                specialisation: form.specialisation.trim(),
              }
            : null,
          profile_incomplete: false,
          account_status: 'active',
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      if (refreshProfile) {
        await refreshProfile();
      }

      setCreatedPharmacoId(finalPharmacoId);
    } catch (err) {
      setApiError(err.message || 'Unable to complete profile right now.');
    } finally {
      setBusy(false);
    }
  };

  const handleContinue = () => {
    navigate('/dashboard', { replace: true });
  };

  if (createdPharmacoId) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-card-wide">
          <div className="auth-success">
            <CheckCircle size={48} color="#34C759" />
            <h2>Profile Completed Successfully!</h2>
            <p>Your account is now fully set up and ready to use.</p>
            <PharmacoBadge id={createdPharmacoId} />
            <p>Save your Pharmaco ID. You can use it to log in from any device at any time.</p>
            <button className="auth-btn-primary" type="button" onClick={handleContinue}>
              Continue to Dashboard
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card auth-card-wide">
        <h1 className="auth-title">Complete Your Profile</h1>
        <p className="auth-subtitle">Almost there! Please complete your profile to start using Pharmaco.</p>

        <PharmacoBadge id={userProfile?.pharmaco_id} />

        {apiError ? (
          <div className="auth-error" role="alert">
            <AlertTriangle size={18} color="#FF3B30" />
            <span>{apiError}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label className="field-label" htmlFor="username">Username <span className="required">*</span></label>
            <input
              id="username"
              className={`field-input ${usernameState.available === true ? 'input-success' : ''} ${usernameState.available === false ? 'input-error' : ''}`}
              value={form.username}
              onChange={(e) => updateField('username', e.target.value.toLowerCase())}
            />
            {usernameState.checking ? <p className="field-hint">Checking availability...</p> : null}
            {usernameState.available === true ? <p className="field-hint" style={{ color: '#34C759', display: 'flex', gap: 6, alignItems: 'center' }}><CheckCircle size={14} /> Available</p> : null}
            {usernameState.available === false ? <p className="field-error">Already taken</p> : null}
            {errors.username ? <p className="field-error">{errors.username}</p> : null}
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="fullName">Full Name (as per government ID) <span className="required">*</span></label>
            <input id="fullName" className="field-input" value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} />
            {errors.full_name ? <p className="field-error">{errors.full_name}</p> : null}
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="email">Email address</label>
            <input id="email" className="field-input" value={userEmail} readOnly disabled />
            <p className="field-hint">We pulled this from your account so you don’t need to re-enter it.</p>
          </div>

          <div className="field-row">
            <div className="field-group">
              <label className="field-label" htmlFor="dob">Date of Birth <span className="required">*</span></label>
              <input id="dob" type="date" className="field-input" max={new Date().toISOString().split('T')[0]} value={form.date_of_birth} onChange={(e) => updateField('date_of_birth', e.target.value)} />
              {errors.date_of_birth ? <p className="field-error">{errors.date_of_birth}</p> : null}
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="gender">Gender <span className="required">*</span></label>
              <select id="gender" className="field-input" value={form.gender} onChange={(e) => updateField('gender', e.target.value)}>
                <option value="">Select</option>
                {GENDERS.map((gender) => <option key={gender} value={gender}>{gender}</option>)}
              </select>
              {errors.gender ? <p className="field-error">{errors.gender}</p> : null}
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="contact">Contact Number (with country code) <span className="required">*</span></label>
            <input id="contact" className="field-input" placeholder="+91 98765 43210" value={form.contact_number} onChange={(e) => updateField('contact_number', e.target.value)} />
            {errors.contact_number ? <p className="field-error">{errors.contact_number}</p> : null}
          </div>

          <div className="field-row">
            <div className="field-group">
              <label className="field-label" htmlFor="country">Country <span className="required">*</span></label>
              <input id="country" className="field-input" value={form.country} onChange={(e) => updateField('country', e.target.value)} />
              {errors.country ? <p className="field-error">{errors.country}</p> : null}
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="state">State / Province <span className="required">*</span></label>
              <input id="state" className="field-input" value={form.state} onChange={(e) => updateField('state', e.target.value)} />
              {errors.state ? <p className="field-error">{errors.state}</p> : null}
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="city">City</label>
            <input id="city" className="field-input" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
          </div>

          <div className="field-group">
            <label className="field-label">Role <span className="required">*</span></label>
            <RoleSelector selected={form.role} onSelect={(value) => updateField('role', value)} />
            {errors.role ? <p className="field-error">{errors.role}</p> : null}
          </div>

          {isHcp ? (
            <>
              <div className="field-group">
                <label className="field-label" htmlFor="designation">Designation <span className="required">*</span></label>
                <select id="designation" className="field-input" value={form.designation} onChange={(e) => updateField('designation', e.target.value)}>
                  <option value="">Select designation</option>
                  {DESIGNATIONS.map((designation) => <option key={designation} value={designation}>{designation}</option>)}
                </select>
                {errors.designation ? <p className="field-error">{errors.designation}</p> : null}
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="registration">Medical Registration Number <span className="required">*</span></label>
                <input id="registration" className="field-input" value={form.medical_registration_number} onChange={(e) => updateField('medical_registration_number', e.target.value)} />
                {errors.medical_registration_number ? <p className="field-error">{errors.medical_registration_number}</p> : null}
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="institution">Institution / Hospital Name <span className="required">*</span></label>
                <input id="institution" className="field-input" value={form.institution_name} onChange={(e) => updateField('institution_name', e.target.value)} />
                {errors.institution_name ? <p className="field-error">{errors.institution_name}</p> : null}
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="specialisation">Specialisation</label>
                <input id="specialisation" className="field-input" value={form.specialisation} onChange={(e) => updateField('specialisation', e.target.value)} />
              </div>
            </>
          ) : null}

          <label className="review-consent">
            <input type="checkbox" checked={form.consent} onChange={(e) => updateField('consent', e.target.checked)} />
            <span>
              I confirm the information provided is accurate and I consent to Pharmaco processing my data for pharmacovigilance purposes in accordance with India&apos;s Digital Personal Data Protection Act 2023 and Pharmaco&apos;s Privacy Policy.
            </span>
          </label>
          {errors.consent ? <p className="field-error">{errors.consent}</p> : null}

          <button className="auth-btn-primary" type="submit" disabled={busy}>
            {busy ? 'Saving profile...' : 'Complete Profile'}
          </button>
        </form>
      </section>
    </main>
  );
}
