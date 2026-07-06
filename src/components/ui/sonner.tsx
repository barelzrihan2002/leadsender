import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr');
  
  useEffect(() => {
    // Watch for dir changes
    const observer = new MutationObserver(() => {
      const htmlDir = document.documentElement.dir as 'ltr' | 'rtl';
      setDir(htmlDir || 'ltr');
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir']
    });
    
    // Set initial dir
    setDir((document.documentElement.dir as 'ltr' | 'rtl') || 'ltr');
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position={dir === 'rtl' ? 'top-left' : 'top-right'}
      dir={dir}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
