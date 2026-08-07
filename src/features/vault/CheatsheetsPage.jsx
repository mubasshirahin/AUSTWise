import Cheatsheets from './Cheatsheets';
import './Cheatsheets.css';
import '../../components/PageHero.css';
import './vault-tokens.css';

export default function CheatsheetsPage() {
  return (
    <div className="csh-page animate-fadeIn">
      {/* Single merged box — Notebook-style masthead header + content
          live together in the cheatsheets-container (like other pages). */}
      <Cheatsheets vaultContext={{ course: null, courseName: 'All courses' }} />
    </div>
  );
}
