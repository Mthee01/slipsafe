import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface User {
  id: string;
  username: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  homeAddress?: string | null;
  idNumber?: string | null;
  profilePicture?: string | null;
  accountType?: string;
  activeContext?: string;
  role?: string;
  businessName?: string | null;
  businessProfile?: {
    businessName: string;
    taxId?: string | null;
    vatNumber?: string | null;
  } | null;
}

interface AuthResponse {
  success: boolean;
  user: User;
}

export function useAuth() {
  const [, setLocation] = useLocation();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/users/me"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/users/me", {
          credentials: "include"
        });
        if (response.status === 401) {
          return null;
        }
        if (!response.ok) {
          throw new Error("Failed to fetch user");
        }
        const data = await response.json();
        return data.user;
      } catch (error) {
        return null;
      }
    },
    retry: false,
    staleTime: Infinity
  });

  const loginMutation = useMutation<AuthResponse, Error, { username: string; password: string }>({
    mutationFn: async ({ username, password }) => {
      const response = await apiRequest("POST", "/api/auth/login", { username, password });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/users/me"], data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setLocation("/");
    }
  });

  const registerMutation = useMutation<AuthResponse & { requiresVerification?: boolean; message?: string }, Error, {
    username: string;
    fullName: string;
    email: string;
    phone: string;
    password: string;
    accountType: "individual" | "business";
    idNumber?: string;
    homeAddress?: string;
    businessName?: string;
    taxId?: string;
    vatNumber?: string;
  }>({
    mutationFn: async (data) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.user) {
        queryClient.setQueryData(["/api/users/me"], data.user);
        setLocation("/");
      } else if (data.requiresVerification) {
        setLocation("/registration-success");
      }
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/users/me"], null);
      queryClient.clear();
      setLocation("/login");
    }
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutate,
    registerError: registerMutation.error,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending
  };
}
