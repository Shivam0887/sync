import type { IParticipant } from "@/types/chat.types";

import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { toastErrorHandler } from "@/lib/utils";
import { apiRequest } from "@/services/api-request";
import { Camera } from "lucide-react";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { chatQueryKeys } from "@/stores/chat-store";

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  directParticipants: IParticipant[];
}

const createGroupSchema = z.object({
  name: z
    .string({ error: "Group name is required" })
    .min(3, { error: "Group name must contain at least 3 characters" }),
  description: z.string(),
  userIds: z.array(z.string()),
  profileImg: z
    .file()
    .refine(
      (file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type),
      { error: "Invalid file format" }
    )
    .optional(),
});

type TGroupValues = z.infer<typeof createGroupSchema>;

const CreateGroupDialog = ({
  open,
  onClose,
  directParticipants,
}: CreateGroupDialogProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const groupForm = useForm<TGroupValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      description: "",
      name: "",
      profileImg: undefined,
    },
  });

  const navigate = useNavigate();

  const handleSubmit = useMutation({
    mutationKey: ["groups"],
    mutationFn: async (values: TGroupValues) => {
      const res = await apiRequest("/chat/groups", {
        method: "POST",
        body: JSON.stringify(values),
      });

      if (!res.ok) throw new Error("Failed to create group");

      const { groupId } = await res.json();
      return groupId as string;
    },
    onError: (error) => {
      toastErrorHandler({ error });
    },
    onSuccess: async (groupId) => {
      await queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversations,
      });
      onClose();
      navigate(`/chat/${groupId}`);
    },
  });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    groupForm.setValue("profileImg", file);

    const temporaryUrl = URL.createObjectURL(file);
    setPreviewUrl(temporaryUrl);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
          <DialogDescription>
            Enter group details and select members to start a new group chat.
          </DialogDescription>
        </DialogHeader>

        <Form {...groupForm}>
          <form
            onSubmit={groupForm.handleSubmit((data) =>
              handleSubmit.mutate(data)
            )}
            className="space-y-4"
          >
            <div className="size-28 relative bg-muted rounded-full mx-auto my-4 overflow-hidden">
              <Camera className="absolute -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 z-0" />
              {groupForm.watch("profileImg") && previewUrl && (
                <img
                  src={previewUrl}
                  alt={groupForm.watch("profileImg")!.name}
                  className="object-cover w-full h-full object-center absolute z-10"
                />
              )}

              <FormField
                control={groupForm.control}
                name="profileImg"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="file"
                        {...field}
                        accept="image/jpeg, image/png, image/webp"
                        multiple={false}
                        value={undefined}
                        onChange={handleFileChange}
                        className="w-full h-full opacity-0 absolute z-50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={groupForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Group Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={groupForm.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Description (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <div className="font-semibold mb-1">Add Members</div>
              <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-2">
                <FormField
                  control={groupForm.control}
                  name="userIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        {directParticipants.map((u) => (
                          <Label
                            key={u.id}
                            className="flex items-center justify-between gap-2"
                          >
                            <div className="flex gap-3 items-center">
                              <Avatar>
                                <AvatarImage src={u.avatarUrl ?? ""} />
                                <AvatarFallback>
                                  {u.username[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="capitalize">{u.username}</span>
                            </div>
                            <Input
                              type="checkbox"
                              checked={field.value.includes(u.id)}
                              onChange={() => {
                                const prev = field.value;
                                field.onChange(
                                  prev.includes(u.id)
                                    ? field.value.filter((uid) => uid !== u.id)
                                    : [...prev, u.id]
                                );
                              }}
                              className="size-4"
                            />
                          </Label>
                        ))}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={handleSubmit.isPending || !groupForm.watch("name")}
            >
              {handleSubmit.isPending ? "Creating..." : "Create Group"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDialog;
