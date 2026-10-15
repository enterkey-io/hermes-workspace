import { createRoot } from 'react-dom/client';
import { OwnerShell } from './OwnerShell';
import { consumeSetupLink } from './setup-link';
import './style.css';
import './chat/chat.css';

const setupProof = consumeSetupLink(window.location, window.history);
createRoot(document.getElementById('root')!).render(<OwnerShell setupProof={setupProof} />);
