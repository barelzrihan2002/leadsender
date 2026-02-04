import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Continue",
  cancelText = "Cancel",
  variant = "default"
}: ConfirmDialogProps) {
  
  // Cleanup on unmount - ensure no stuck styles
  useEffect(() => {
    return () => {
      // Clean up any stuck pointer-events when component unmounts
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    };
  }, []);

  const handleConfirm = () => {
    // Execute action first
    onConfirm();
    
    // Force cleanup
    setTimeout(() => {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    }, 100);
  };

  const handleCancel = () => {
    onOpenChange(false);
    
    // Force cleanup
    setTimeout(() => {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    }, 100);
  };

  // Don't render at all if not open - ensures complete cleanup
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} type="button">
            {cancelText}
          </Button>
          <Button variant={variant} onClick={handleConfirm} type="button">
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
