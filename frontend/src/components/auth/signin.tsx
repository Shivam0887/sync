import { Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { signinSchema } from "@/lib/schema";
import type { AuthType } from "@/types/auth.types";
import { useAuth } from "@/providers/auth-provider";
import { toastErrorHandler } from "@/lib/utils";
import { toast } from "sonner";

type TSignin = z.infer<typeof signinSchema>;

interface SigninProps {
  setAuthType: React.Dispatch<React.SetStateAction<AuthType>>;
}

const Signin = ({ setAuthType }: SigninProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const { signin } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const form = useForm<TSignin>({
    resolver: zodResolver(signinSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleSubmit = async (values: TSignin) => {
    try {
      const response = await signin(values.email, values.password);
      if (response.success) {
        toast(response.message);
        const from = location.state?.from?.pathname || "/chat";
        navigate(from);
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
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h2 className="mt-6 text-center text-3xl text-foreground">
              Sign in to your account
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Or{" "}
              <Button
                type="button"
                variant="link"
                onClick={() => setAuthType("signup")}
                className="font-medium text-primary hover:text-primary/80"
              >
                create a new account
              </Button>
            </p>
          </div>

          <Form {...form}>
            <form
              className="mt-8 space-y-6"
              onSubmit={form.handleSubmit(handleSubmit)}
            >
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        htmlFor="email"
                        className="text-sm font-medium text-foreground"
                      >
                        Email address
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="email"
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
                        className="text-sm font-medium text-foreground"
                      >
                        Password
                      </FormLabel>
                      <FormControl>
                        <div className="mt-1 flex relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            className="pr-10 text-sm"
                            {...field}
                          />
                          <Button
                            size="icon"
                            type="button"
                            variant="secondary"
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
                  "Sign in"
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Signin;
