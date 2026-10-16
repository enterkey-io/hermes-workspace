import { createRoot } from 'react-dom/client';
import { OwnerShell } from './OwnerShell';
import { consumeSetupLink } from './setup-link';
import { registerPwa } from './pwa';
import './ui/theme.css';
import { TooltipProvider } from './components/ui/tooltip';

const setupProof = consumeSetupLink(window.location, window.history);
registerPwa();
createRoot(document.getElementById('root')!).render(
  <TooltipProvider>
    <OwnerShell setupProof={setupProof} />
  </TooltipProvider>,
);
