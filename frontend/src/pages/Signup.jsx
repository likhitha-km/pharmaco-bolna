import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Eye, EyeOff, XCircle } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import GoogleOAuthButton from '../components/auth/GoogleOAuthButton.jsx';
import PharmacoBadge from '../components/auth/PharmacoBadge.jsx';
import RoleSelector from '../components/auth/RoleSelector.jsx';
import { mapFirebaseError } from '../utils/firebaseErrors.js';
import { validators } from '../utils/validators.js';

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

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

const initialForm = {
  role: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  full_name: '',
  date_of_birth: '',
  gender: '',
  contact_number: '',
  country: 'India',
  state: '',
  city: '',
  designation: '',
  medical_registration_number: '',
  institution_name: '',
  specialisation: '',
  consent: false,
};

function requirementsForPassword(password) {
  return [
    { key: 'len', label: 'At least 8 characters', ok: password.length >= 8 },
    { key: 'upper', label: 'At least one uppercase letter', ok: /[A-Z]/.test(password) },
    { key: 'num', label: 'At least one number', ok: /[0-9]/.test(password) },
    { key: 'spec', label: 'At least one special character', ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

function passwordStrength(password) {
  const reqs = requirementsForPassword(password);
  const passed = reqs.filter((item) => item.ok).length;

  if (password.length < 8) {
    return 1;
  }
  if (passed <= 2) {
    return 2;
  }
  if (passed === 3) {
    return 3;
  }
  return 4;
}

async function checkUsernameAvailable(username) {
  if (!db) {
    return true;
  }

  const usersRef = collection(db, 'users');
  const usernameQuery = query(usersRef, where('username', '==', username), limit(1));
  const snapshot = await getDocs(usernameQuery);
  return snapshot.empty;
}

export default function Signup() {
  const navigate = useNavigate();
  const { user, loading, signUpWithEmail, signInWithGoogle } = useAuth();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [usernameState, setUsernameState] = useState({ checking: false, available: null });
  const [apiError, setApiError] = useState('');
  const [created, setCreated] = useState(null);

  const isHcp = form.role === 'healthcare_professional';
  const reviewStep = isHcp ? 5 : 4;
  const totalSteps = reviewStep;

  const stepLabels = useMemo(
    () => (isHcp
      ? ['Role', 'Account', 'Personal', 'Professional', 'Review']
      : ['Role', 'Account', 'Personal', 'Review']),
    [isHcp]
  );

  useEffect(() => {
    const normalized = form.username.trim().toLowerCase();
    const formatError = validators.username(normalized);

    if (!normalized || formatError) {
      setUsernameState({ checking: false, available: null });
      return undefined;
    }

    setUsernameState({ checking: true, available: null });
    const timer = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(normalized);
        setUsernameState({ checking: false, available });
      } catch (_err) {
        setUsernameState({ checking: false, available: null });
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [form.username]);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validateStep = async (stepNumber) => {
    const nextErrors = {};

    if (stepNumber === 1) {
      if (!form.role) {
        nextErrors.role = 'Please select your role to continue.';
      }
    }

    if (stepNumber === 2) {
      nextErrors.username = validators.username(form.username?.trim().toLowerCase());
      nextErrors.email = validators.email(form.email);
      nextErrors.password = validators.password(form.password);
      nextErrors.confirmPassword = validators.confirmPassword(form.password, form.confirmPassword);

      if (!nextErrors.username) {
        const available = await checkUsernameAvailable(form.username.trim().toLowerCase());
        if (!available) {
          nextErrors.username = 'This username is already taken.';
        }
      }
    }

    if (stepNumber === 3) {
      nextErrors.full_name = validators.fullName(form.full_name);
      nextErrors.date_of_birth = validators.dateOfBirth(form.date_of_birth);
      nextErrors.gender = !form.gender ? 'Please select your gender.' : null;
      nextErrors.contact_number = validators.contactNumber(form.contact_number);
      nextErrors.country = !form.country.trim() ? 'Country is required.' : null;
      nextErrors.state = !form.state.trim() ? 'State / Province is required.' : null;
    }

    if (stepNumber === 4 && isHcp) {
      nextErrors.designation = !form.designation ? 'Designation is required.' : null;
      nextErrors.medical_registration_number = validators.medicalRegistrationNumber(
        form.medical_registration_number,
        form.role
      );
      nextErrors.institution_name = !form.institution_name.trim() ? 'Institution / Hospital Name is required.' : null;
    }

    if (stepNumber === reviewStep) {
      if (!form.consent) {
        nextErrors.consent = 'You must provide consent before creating an account.';
      }
    }

    const filtered = Object.fromEntries(Object.entries(nextErrors).filter(([, value]) => Boolean(value)));
    setErrors((prev) => ({ ...prev, ...filtered }));
    return Object.keys(filtered).length === 0;
  };

  const handleNext = async () => {
    const valid = await validateStep(step);
    if (!valid) {
      return;
    }
    setStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleGoogle = async () => {
    if (!form.role) {
      setErrors((prev) => ({ ...prev, role: 'Please select your role to continue with Google.' }));
      return;
    }

    setApiError('');
    setGoogleBusy(true);
    try {
      const result = await signInWithGoogle(form.role);
      navigate(result.isNewUser ? '/complete-profile' : '/dashboard', { replace: true });
    } catch (err) {
      setApiError(mapFirebaseError(err.code || err.message));
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleCreateAccount = async () => {
    const valid = await validateStep(reviewStep);
    if (!valid) {
      return;
    }

    setBusy(true);
    setApiError('');

    try {
      const payload = {
        ...form,
        username: form.username.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
        contact_number: form.contact_number.replace(/[\s\-()]/g, ''),
      };

      const result = await signUpWithEmail(payload);
      setCreated({ email: payload.email, pharmacoId: result.pharmaco_id });
    } catch (err) {
      if (err?.message === 'google-account-existing') {
        setApiError('This email is already linked to a Google account. Please sign in with Google instead.');
      } else {
        setApiError(mapFirebaseError(err.code || err.message));
      }
    } finally {
      setBusy(false);
    }
  };

  const passwordReqs = requirementsForPassword(form.password);
  const strength = passwordStrength(form.password);

  return (
    <main className="auth-page">
      <section className="auth-card auth-card-wide">
        <img className="auth-logo" src="/pharmaco-logo.png" alt="Pharmaco" style={{ height: 32 }} />

        {created ? (
          <div className="auth-success">
            <CheckCircle size={48} color="#34C759" />
            <h2>Account Created Successfully!</h2>
            <p>
              A verification email has been sent to {created.email}. Please verify your email to activate your account.
            </p>
            <PharmacoBadge id={created.pharmacoId} />
            <p>Save your Pharmaco ID. You can use it to log in from any device at any time.</p>
            <button className="auth-btn-primary" type="button" onClick={() => navigate('/verify-email')}>
              Continue to Email Verification
            </button>
          </div>
        ) : (
          <>
            <div className="step-progress" aria-label="Signup progress">
              {stepLabels.map((label, index) => {
                const number = index + 1;
                const current = number === step;
                const done = number < step;

                return (
                  <div className="step-dot" key={label}>
                    <div className={`step-circle ${current ? 'current' : ''} ${done ? 'done' : ''}`}>
                      {done ? '✓' : number}
                    </div>
                    <p className="step-label">{label}</p>
                  </div>
                );
              })}
            </div>

            {apiError ? (
              <div className="auth-error" role="alert">
                <AlertTriangle size={18} color="#FF3B30" aria-hidden="true" />
                <span>{apiError}</span>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="step-content">
                <h2>Choose Your Role</h2>
                <p className="step-desc">Select the role that best describes how you will use Pharmaco.</p>
                <RoleSelector selected={form.role} onSelect={(role) => updateField('role', role)} />
                {errors.role ? <p className="field-error">{errors.role}</p> : null}

                {form.role ? (
                  <>
                    <div style={{ marginTop: 16 }}>
                      <GoogleOAuthButton
                        onClick={handleGoogle}
                        loading={googleBusy}
                        label={`Continue with Google as ${form.role === 'patient' ? 'Patient' : 'Healthcare Professional'}`}
                      />
                    </div>
                    <div className="auth-divider" aria-hidden="true">
                      <span />
                      <p>or create account with email</p>
                      <span />
                    </div>
                  </>
                ) : null}

                <div className="step-nav">
                  <span />
                  <button className="auth-btn-primary" type="button" onClick={handleNext}>Continue</button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="step-content">
                <h2>Account Setup</h2>
                <p className="step-desc">Create your secure account credentials.</p>

                <div className="field-group">
                  <label className="field-label" htmlFor="username">Username <span className="required">*</span></label>
                  <input
                    id="username"
                    className={`field-input ${usernameState.available === true ? 'input-success' : ''} ${usernameState.available === false ? 'input-error' : ''}`}
                    value={form.username}
                    onChange={(e) => updateField('username', e.target.value.toLowerCase())}
                    onBlur={() => validateStep(2)}
                    placeholder="rahul23"
                  />
                  <p className="field-hint">Lowercase letters and numbers only. No spaces or special characters. 4-20 characters.</p>
                  {usernameState.checking ? <p className="field-hint">Checking availability...</p> : null}
                  {!usernameState.checking && usernameState.available === true ? (
                    <p className="field-hint" style={{ color: '#34C759', display: 'flex', gap: 6, alignItems: 'center' }}><CheckCircle size={14} /> Available</p>
                  ) : null}
                  {!usernameState.checking && usernameState.available === false ? (
                    <p className="field-error" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><XCircle size={14} /> Already taken</p>
                  ) : null}
                  {errors.username ? <p className="field-error">{errors.username}</p> : null}
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="email">Email Address <span className="required">*</span></label>
                  <input
                    id="email"
                    type="email"
                    className="field-input"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="you@example.com"
                  />
                  {errors.email ? <p className="field-error">{errors.email}</p> : null}
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="password">Password <span className="required">*</span></label>
                  <div className="field-input-wrapper">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="field-input"
                      value={form.password}
                      onChange={(e) => updateField('password', e.target.value)}
                    />
                    <button
                      type="button"
                      className="input-icon-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="password-meter" aria-hidden="true">
                    {[1, 2, 3, 4].map((segment) => (
                      <span
                        key={segment}
                        className={`password-meter-segment ${segment <= strength ? `strength-${strength}` : ''}`}
                      />
                    ))}
                  </div>
                  {passwordReqs.filter((item) => !item.ok).map((item) => (
                    <p key={item.key} className="field-hint">• {item.label}</p>
                  ))}
                  {errors.password ? <p className="field-error">{errors.password}</p> : null}
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="confirmPassword">Confirm Password <span className="required">*</span></label>
                  <div className="field-input-wrapper">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="field-input"
                      value={form.confirmPassword}
                      onChange={(e) => updateField('confirmPassword', e.target.value)}
                    />
                    <button
                      type="button"
                      className="input-icon-btn"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.confirmPassword ? <p className="field-error">{errors.confirmPassword}</p> : null}
                </div>

                <div className="step-nav">
                  <button className="auth-btn-ghost" type="button" onClick={handleBack}>Back</button>
                  <button className="auth-btn-primary" type="button" onClick={handleNext}>Continue</button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="step-content">
                <h2>Personal Information</h2>
                <p className="step-desc">This information is required for pharmacovigilance reporting standards.</p>

                <div className="field-group">
                  <label className="field-label" htmlFor="fullName">Full Name (as per government ID) <span className="required">*</span></label>
                  <input id="fullName" className="field-input" value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} />
                  {errors.full_name ? <p className="field-error">{errors.full_name}</p> : null}
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label className="field-label" htmlFor="dob">Date of Birth <span className="required">*</span></label>
                    <input id="dob" type="date" className="field-input" value={form.date_of_birth} max={new Date().toISOString().split('T')[0]} onChange={(e) => updateField('date_of_birth', e.target.value)} />
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
                  <p className="field-hint">Used for account security. Not used for SMS verification at this time.</p>
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

                <div className="step-nav">
                  <button className="auth-btn-ghost" type="button" onClick={handleBack}>Back</button>
                  <button className="auth-btn-primary" type="button" onClick={handleNext}>Continue</button>
                </div>
              </div>
            ) : null}

            {step === 4 && isHcp ? (
              <div className="step-content">
                <h2>Professional Details</h2>
                <p className="step-desc">Provide your professional credentials for healthcare reporting tools.</p>

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
                  <p className="field-hint">As issued by NMC, State Medical Council, Pharmacy Council of India, or equivalent body.</p>
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

                <div className="step-nav">
                  <button className="auth-btn-ghost" type="button" onClick={handleBack}>Back</button>
                  <button className="auth-btn-primary" type="button" onClick={handleNext}>Continue</button>
                </div>
              </div>
            ) : null}

            {step === reviewStep ? (
              <div className="step-content">
                <h2>Review and Submit</h2>
                <p className="step-desc">Confirm your details before creating your account.</p>

                <div className="review-section">
                  <h3>Account Details</h3>
                  <div className="review-row"><span className="review-label">Username</span><span className="review-value">{form.username}</span></div>
                  <div className="review-row"><span className="review-label">Email</span><span className="review-value">{form.email}</span></div>
                  <div className="review-row"><span className="review-label">Role</span><span className="review-value">{form.role === 'patient' ? 'Patient' : 'Healthcare Professional'}</span></div>
                </div>

                <div className="review-section">
                  <h3>Personal Details</h3>
                  <div className="review-row"><span className="review-label">Full Name</span><span className="review-value">{form.full_name}</span></div>
                  <div className="review-row"><span className="review-label">Date of Birth</span><span className="review-value">{form.date_of_birth}</span></div>
                  <div className="review-row"><span className="review-label">Gender</span><span className="review-value">{form.gender}</span></div>
                  <div className="review-row"><span className="review-label">Contact Number</span><span className="review-value">{form.contact_number}</span></div>
                  <div className="review-row"><span className="review-label">Location</span><span className="review-value">{[form.city, form.state, form.country].filter(Boolean).join(', ')}</span></div>
                </div>

                {isHcp ? (
                  <div className="review-section">
                    <h3>Professional Details</h3>
                    <div className="review-row"><span className="review-label">Designation</span><span className="review-value">{form.designation}</span></div>
                    <div className="review-row"><span className="review-label">Registration Number</span><span className="review-value">{form.medical_registration_number}</span></div>
                    <div className="review-row"><span className="review-label">Institution</span><span className="review-value">{form.institution_name}</span></div>
                    <div className="review-row"><span className="review-label">Specialisation</span><span className="review-value">{form.specialisation || '—'}</span></div>
                  </div>
                ) : null}

                <label className="review-consent">
                  <input type="checkbox" checked={form.consent} onChange={(e) => updateField('consent', e.target.checked)} />
                  <span>
                    I confirm the information provided is accurate and I consent to Pharmaco processing my data for pharmacovigilance purposes in accordance with India&apos;s Digital Personal Data Protection Act 2023 and Pharmaco&apos;s Privacy Policy.
                  </span>
                </label>
                {errors.consent ? <p className="field-error">{errors.consent}</p> : null}

                <div className="step-nav">
                  <button className="auth-btn-ghost" type="button" onClick={handleBack}>Back</button>
                  <button className="auth-btn-primary" type="button" onClick={handleCreateAccount} disabled={busy}>
                    {busy ? 'Creating your account...' : 'Create Account'}
                  </button>
                </div>
              </div>
            ) : null}

            <p className="auth-switch">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
