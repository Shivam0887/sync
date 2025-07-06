import { User } from "lucide-react";
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
import { useAuth } from "@/providers/auth-provider";
import { toastErrorHandler } from "@/lib/utils";

const usernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(255, { message: "Username can't be greater than 255 characters" }),
});

const Username = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { onSignUpSuccess, apiRequest, setAuthModalOpen } = useAuth();

  const form = useForm<z.infer<typeof usernameSchema>>({
    resolver: zodResolver(usernameSchema),
    defaultValues: {
      username: "",
    },
  });

  const handleSubmit = async (values: z.infer<typeof usernameSchema>) => {
    try {
      const response = await apiRequest("/user/update-username", {
        method: "PATCH",
        body: JSON.stringify({ username: values.username }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || "Unable to set username"
        );
      }

      onSignUpSuccess(values.username);
      setAuthModalOpen(false);

      const from = location.state?.from?.pathname || "/chat";
      navigate(from, { replace: true });
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
              Setup your username
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              This username is used to communicate with others
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
                          {...field}
                        />
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
                  "create"
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Username;
