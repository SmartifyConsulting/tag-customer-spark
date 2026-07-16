import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        // Every toast (success/error/warning/info/default) is black with
        // white text — Sonner's stock per-type colors (green/red/etc.)
        // clash with the app's palette, and black/white reads consistently
        // regardless of type.
        classNames: {
          toast:
            "group toast group-[.toaster]:!bg-black group-[.toaster]:!text-white group-[.toaster]:!border-black group-[.toaster]:shadow-lg",
          description: "group-[.toast]:!text-white/70",
          actionButton: "group-[.toast]:!bg-white group-[.toast]:!text-black",
          cancelButton: "group-[.toast]:!bg-white/20 group-[.toast]:!text-white",
          success:
            "group-[.toaster]:!bg-black group-[.toaster]:!text-white group-[.toaster]:!border-black",
          error:
            "group-[.toaster]:!bg-black group-[.toaster]:!text-white group-[.toaster]:!border-black",
          warning:
            "group-[.toaster]:!bg-black group-[.toaster]:!text-white group-[.toaster]:!border-black",
          info: "group-[.toaster]:!bg-black group-[.toaster]:!text-white group-[.toaster]:!border-black",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
