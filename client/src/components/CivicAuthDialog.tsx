import { useEffect, useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
export function CivicAuthDialog() {
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const onSuccess = async () => {
    setPassword("");
    setOpen(false);
    await utils.invalidate();
  };
  const login = trpc.auth.login.useMutation({ onSuccess }),
    register = trpc.auth.register.useMutation({ onSuccess });
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("civicfix:sign-in", show);
    return () => window.removeEventListener("civicfix:sign-in", show);
  }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "login") login.mutate({ email, password });
    else register.mutate({ name, email, password });
  };
  const pending = login.isPending || register.isPending;
  const error = mode === "login" ? login.error : register.error;
  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        setOpen(value);
        if (!value) setPassword("");
      }}
    >
      <DialogContent className="rounded-2xl bg-[#fbfdfb] sm:max-w-md">
        <DialogTitle className="font-display text-2xl text-[#153e35]">
          {mode === "login"
            ? "Sign in to CivicFix"
            : "Create your CivicFix account"}
        </DialogTitle>
        <DialogDescription>
          Track your civic reports and receive private status updates.
        </DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <label className="block text-sm">
              Name
              <Input
                autoComplete="name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                maxLength={120}
              />
            </label>
          )}
          <label className="block text-sm">
            Email
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              maxLength={320}
            />
          </label>
          <label className="block text-sm">
            Password
            <Input
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 12 : 1}
              maxLength={72}
            />
          </label>
          {mode === "register" && (
            <p className="text-xs text-[#5c7169]">
              Use 12 or more characters, up to 72 UTF-8 bytes.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error.message}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-[#153e35]"
          >
            {pending
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            login.reset();
            register.reset();
          }}
        >
          {mode === "login"
            ? "Create an account"
            : "Already registered? Sign in"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
