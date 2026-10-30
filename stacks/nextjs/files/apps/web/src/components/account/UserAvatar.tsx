import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/initials";

// Profiles have no photo upload yet, so every avatar shows initials.
export function UserAvatar({
  name,
  size,
  className,
  fallbackClassName,
}: {
  name: string;
  size?: "sm" | "default" | "lg";
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className={fallbackClassName}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
