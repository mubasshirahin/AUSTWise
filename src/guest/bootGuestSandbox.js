// Imported first in main.jsx: if this tab is on a guest visit, the sandbox must
// be live before any other module reads localStorage or calls the API.
import { installGuestSandbox, isGuestVisitFlagged } from './guestSandbox';

if (isGuestVisitFlagged()) installGuestSandbox();
