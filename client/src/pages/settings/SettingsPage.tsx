import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/user-avatar";

import { useAuthStore } from "@/features/auth/authStore";
import { profileSchema, type ProfileFormValues } from "@/features/user/user.schema";
import { useUpdateProfile } from "@/features/user/useUser";
import type { AuthUser } from "@/lib/types";

// Mirrors server/src/middleware/uploadImage.ts
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 md:px-6 md:py-10 space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      {user && <ProfileForm user={user} />}
    </div>
  );
}

function ProfileForm({ user }: { user: AuthUser }) {
  const { mutate: saveProfile, isPending } = useUpdateProfile();
  const fileInput = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, dirtyFields },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name },
  });

  const replaceImage = (file: File | null) => {
    if (image) URL.revokeObjectURL(image.preview);
    setImage(file && { file, preview: URL.createObjectURL(file) });
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // lets the same file be picked again after an error
    if (!file) return;

    if (!IMAGE_TYPES.includes(file.type)) {
      toast.error("Image must be a JPEG, PNG or WebP file");
    } else if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be 5 MB or smaller");
    } else {
      replaceImage(file);
    }
  };

  const onSubmit = ({ name }: ProfileFormValues) => {
    const body = new FormData();
    if (dirtyFields.name) body.append("name", name);
    if (image) body.append("image", image.file);

    saveProfile(body, {
      onSuccess: ({ user: saved }) => {
        reset({ name: saved.name });
        replaceImage(null);
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="surface space-y-5" noValidate>
      <h2 className="text-lg font-semibold">Profile</h2>

      <div className="flex items-center gap-4">
        <UserAvatar
          user={{ name: user.name, profileUrl: image?.preview ?? user.profileUrl }}
          className="size-20"
          fallbackClassName="text-2xl"
        />
        <div className="space-y-2">
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-label="Profile picture"
            onChange={onFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
          >
            <Camera /> Change picture
          </Button>
          <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 5 MB.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-name">Name</Label>
        <Input id="profile-name" aria-invalid={!!errors.name} {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" value={user.email} readOnly disabled />
      </div>

      <Button type="submit" disabled={isPending || (!dirtyFields.name && !image)}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
