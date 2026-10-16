import type { ComponentProps, ComponentType } from 'react';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

type IconButtonProps = Omit<ComponentProps<typeof Button>, 'children' | 'aria-label'> & {
  label: string;
  icon: ComponentType<{ className?: string }>;
  quiet?: boolean;
};

export function IconButton({
  label,
  icon: Glyph,
  quiet = false,
  variant = 'ghost',
  size = 'icon-sm',
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={quiet ? 'quiet' : variant}
          size={size}
          aria-label={label}
          {...props}
        >
          <Glyph />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
