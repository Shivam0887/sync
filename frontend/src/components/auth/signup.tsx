import { z } from "zod";

import { useState } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { Eye, EyeOff } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signupSchema } from "@/lib/schema";
import { toastErrorHandler } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthActions } from "@/stores/auth-store";
import { apiRequest } from "@/services/api-request";

type TSignup = z.infer<typeof signupSchema>;

const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { signup } = useAuthActions();

  const form = useForm<TSignup>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      confirmPassword: "",
      email: "",
      password: "",
      username: "",
    },
  });

  const handleSubmitCredentials = async (values: TSignup) => {
    try {
      const usernameRes = await apiRequest(
        `/user/username/${values.username}/check`
      );

      const data = await usernameRes.json();

      if (!usernameRes.ok) {
        throw new Error(
          data?.message || data?.error || "Unable to set username"
        );
      }

      if (values.password !== values.confirmPassword) {
        throw new Error("Password & confirm-password didn't matched");
      }

      const response = await signup(
        values.email,
        values.username,
        values.password,
        values.confirmPassword
      );

      if (!response.success) {
        throw new Error(response.error);
      }

      toast(response.message);
    } catch (error) {
      toastErrorHandler({ error });
    }
  };

  return (
    <div className="flex items-center justify-center bg-background">
      <div className="max-w-4xl w-full flex overflow-hidden">
        <div className="w-full max-w-xl px-6 pb-6 space-y-8">
          <Form {...form}>
            <form
              className="mt-8 space-y-6"
              onSubmit={form.handleSubmit(handleSubmitCredentials)}
            >
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        htmlFor="username"
                        className="text-sm font-medium text-foreground"
                      >
                        Username
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="username"
                          autoComplete="username"
                          className="mt-1"
                          placeholder="john123"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        htmlFor="email"
                        className="block text-sm font-medium text-foreground"
                      >
                        Email address
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="email"
                          type="email"
                          autoComplete="email"
                          className="mt-1 text-sm"
                          placeholder="demo@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        htmlFor="password"
                        className="block text-sm font-medium text-foreground"
                      >
                        Password
                      </FormLabel>
                      <FormControl>
                        <div className="mt-1 flex relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            className="pr-10 text-sm"
                            {...field}
                          />
                          <Button
                            size="icon"
                            variant="secondary"
                            type="button"
                            className="absolute right-0"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Eye className="h-5 w-5 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium text-foreground"
                      >
                        Confirm Password
                      </FormLabel>
                      <FormControl>
                        <div className="mt-1 flex relative">
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            autoComplete="new-password"
                            className="pr-10 text-sm"
                            {...field}
                          />
                          <Button
                            size="icon"
                            type="button"
                            variant="secondary"
                            className="flex justify-center absolute right-0"
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Eye className="h-5 w-5 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                variant="ghost"
                disabled={form.formState.isSubmitting}
                className="w-full"
              >
                {form.formState.isSubmitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
