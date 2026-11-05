import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/authStore";
import { updateProfile } from "@/features/user/user.api";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: ({ user }) => {
      useAuthStore.setState({ user });
      // The name and picture appear across members, expenses, balances and chores
      queryClient.invalidateQueries();
      toast.success("Profile updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
