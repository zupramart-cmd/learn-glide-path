import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ImagePreviewDialogProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function ImagePreviewDialog({ src, alt = "Preview", onClose }: ImagePreviewDialogProps) {
  return (
    <Dialog open={!!src} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 sm:p-4 flex items-center justify-center">
        <VisuallyHidden><DialogTitle>Image Preview</DialogTitle></VisuallyHidden>
        {src && (
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
