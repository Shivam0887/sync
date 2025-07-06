import { z } from "zod";

import { useState } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { Eye, EyeOff, User } from "lucide-react";
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
import type { AuthType } from "@/types/auth.types";
import { useAuth } from "@/providers/auth-provider";
import { toastErrorHandler } from "@/lib/utils";
import { toast } from "sonner";

type TSignup = z.infer<typeof signupSchema>;

interface SignupProps {
  setAuthType: React.Dispatch<React.SetStateAction<AuthType>>;
}

const Signup = ({ setAuthType }: SignupProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { signup } = useAuth();

  const form = useForm<TSignup>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      confirmPassword: "",
      email: "",
      password: "",
    },
  });

  const handleSubmitCredentials = async (values: TSignup) => {
    if (values.password !== values.confirmPassword) {
      toastErrorHandler({
        defaultErrorMsg: "Password & confirm-password didn't matched",
      });
      return;
    }

    try {
      const response = await signup(
        values.email,
        values.password,
        values.confirmPassword
      );

      if (response.success) {
        toast(response.message);
      }
    } catch (error) {
      toastErrorHandler({ error });
    }
  };

  return (
    <div className="flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full flex overflow-hidden">
        <div className="w-full max-w-xl p-4 md:p-8 space-y-8">
          <div>
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <h2 className="mt-6 text-center text-3xl text-foreground">
              Create your account
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Or{" "}
              <Button
                type="button"
                variant="link"
                onClick={() => setAuthType("signin")}
                className="font-medium text-primary hover:text-primary/80"
              >
                sign in to existing account
              </Button>
            </p>
          </div>

          <Form {...form}>
            <form
              className="mt-8 space-y-6"
              onSubmit={form.handleSubmit(handleSubmitCredentials)}
            >
              <div className="space-y-4">
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
