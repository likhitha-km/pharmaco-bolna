const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M17.64 9.2045c0-.6382-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2087 1.125-.8432 2.0782-1.7973 2.715v2.2582h2.9087c1.7023-1.5673 2.6849-3.8782 2.6849-6.6141z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1818l-2.9087-2.2582c-.806.54-1.8373.8591-3.0477.8591-2.3432 0-4.3278-1.5818-5.036-3.7091H.9573v2.3291C2.4382 16.0118 5.4818 18 9 18z" />
    <path fill="#FBBC05" d="M3.964 10.7109A5.4095 5.4095 0 013.6818 9c0-.5932.1023-1.1691.2822-1.7109V4.96H.9573A8.9957 8.9957 0 000 9c0 1.4536.3482 2.8309.9573 4.04l3.0067-2.3291z" />
    <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5078.4545 3.4405 1.3454l2.5804-2.58C13.4632.891 11.426 0 9 0 5.4818 0 2.4382 1.9882.9573 4.96L3.964 7.2891C4.6722 5.1618 6.6568 3.5795 9 3.5795z" />
  </svg>
);

export default function GoogleOAuthButton({ onClick, loading = false, label = 'Continue with Google' }) {
  return (
    <button
      type="button"
      className="google-btn"
      onClick={onClick}
      disabled={loading}
      aria-label={label}
    >
      <GoogleIcon />
      <span>{loading ? 'Please wait...' : label}</span>
    </button>
  );
}
