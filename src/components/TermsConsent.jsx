import './TermsConsent.css';

/**
 * Required "I agree" checkbox for account creation. Links open in a new tab
 * so a half-filled signup form is not lost.
 */
export default function TermsConsent({ checked, onChange, invalid = false, id = 'terms-consent' }) {
  return (
    <label className={`terms-consent${invalid ? ' is-invalid' : ''}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        name="acceptedTerms"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid || undefined}
        aria-required="true"
      />
      <span>
        I agree to the{' '}
        <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
        {' '}and{' '}
        <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
      </span>
    </label>
  );
}
