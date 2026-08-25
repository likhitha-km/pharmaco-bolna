const usernameRegex = /^[a-z0-9]+$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fullNameRegex = /^[A-Za-z .'-]+$/;
const contactRegex = /^\+?[0-9]{7,15}$/;

export const validators = {
  username(value) {
    const input = (value || '').trim();
    if (!input) {
      return 'Username is required.';
    }
    if (input.length < 4) {
      return 'Username must be at least 4 characters.';
    }
    if (input.length > 20) {
      return 'Username must be 20 characters or less.';
    }
    if (!usernameRegex.test(input)) {
      return 'Username can only contain lowercase letters and numbers. No spaces or special characters allowed.';
    }
    return null;
  },

  email(value) {
    const input = (value || '').trim();
    if (!input) {
      return 'Email is required.';
    }
    if (!emailRegex.test(input)) {
      return 'Enter a valid email address.';
    }
    return null;
  },

  password(value) {
    const input = value || '';
    if (!input) {
      return 'Password is required.';
    }
    if (input.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (!/[A-Z]/.test(input)) {
      return 'Password must include at least one uppercase letter.';
    }
    if (!/[0-9]/.test(input)) {
      return 'Password must include at least one number.';
    }
    if (!/[^A-Za-z0-9]/.test(input)) {
      return 'Password must include at least one special character.';
    }
    return null;
  },

  confirmPassword(password, confirm) {
    if ((confirm || '').length === 0) {
      return 'Please confirm your password.';
    }
    if (password !== confirm) {
      return 'Passwords do not match';
    }
    return null;
  },

  fullName(value) {
    const input = (value || '').trim();
    if (!input) {
      return 'Full name is required.';
    }
    if (input.length < 3 || !fullNameRegex.test(input)) {
      return 'Enter your full name as it appears on your government ID.';
    }
    return null;
  },

  dateOfBirth(value) {
    if (!value) {
      return 'Date of birth is required.';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Enter a valid date of birth.';
    }

    const today = new Date();
    const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
    const maxDate = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());

    if (parsed > today) {
      return 'Date of birth cannot be in the future.';
    }
    if (parsed < minDate) {
      return 'Enter a valid date of birth.';
    }
    if (parsed > maxDate) {
      return 'You must be at least 13 years old.';
    }

    return null;
  },

  contactNumber(value) {
    const sanitized = (value || '').replace(/[\s\-()]/g, '');
    if (!sanitized) {
      return 'Contact number is required.';
    }
    if (!contactRegex.test(sanitized)) {
      return 'Enter a valid contact number with country code (e.g. +91 98765 43210)';
    }
    return null;
  },

  medicalRegistrationNumber(value, role) {
    if (role !== 'healthcare_professional') {
      return null;
    }

    const input = (value || '').trim();
    if (!input) {
      return 'Medical registration number is required for healthcare professionals.';
    }
    if (input.length < 3) {
      return 'Medical registration number must be at least 3 characters.';
    }
    return null;
  },
};
