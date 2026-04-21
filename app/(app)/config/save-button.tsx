"use client";

import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SaveButtonProps {
  pending: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function SaveButton({ pending, children = "Guardar cambios", className }: SaveButtonProps) {
  return (
    <Button type="submit" disabled={pending} className={cn("h-11 gap-1.5", className)}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {children}
    </Button>
  );
}
