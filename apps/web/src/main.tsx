import { createRoot } from 'react-dom/client';
import { OwnerShell } from './OwnerShell';
import { consumeSetupLink } from './setup-link';
import './ui/theme.css';
import { TooltipProvider } from './components/ui/tooltip';

const setupProof = consumeSetupLink(window.location, window.history);
createRoot(document.getElementById('root')!).render(
  <TooltipProvider>
    <OwnerShell setupProof={setupProof} />
  </TooltipProvider>,
);
