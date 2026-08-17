import { useMutation } from "@tanstack/react-query";

import type { WaitlistErrorCode } from "@/lib/waitlist/email";

export type WaitlistJoinInput = {
  email: string;
  source: "landing" | "end-of-demo";
};

export type WaitlistJoinResult =
  | { ok: true }
  | { ok: false; code?: WaitlistErrorCode };

export const queryKeys = {
  conversations: ["conversations"] as const,
  proof: (slug: string) => ["proof", slug] as const,
};

export function useJoinWaitlist() {
  return useMutation({
    mutationFn: async (input: WaitlistJoinInput): Promise<WaitlistJoinResult> => {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        code?: WaitlistErrorCode;
      };
      if (!response.ok || !payload.ok) {
        return { ok: false, code: payload.code };
      }
      return { ok: true };
    },
  });
}

export function useSaveHandle() {
  return useMutation({
    mutationFn: async (handle: string) => {
      const response = await fetch("/api/site-handle", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      if (!response.ok) throw new Error("handle");
      return response.json() as Promise<{ ok: true; handle: string }>;
    },
  });
}

export function useSendSupport() {
  return useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) throw new Error("support");
      return response.json() as Promise<{ ok: true }>;
    },
  });
}

export function useBillingCheckout() {
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const answer = (await response.json()) as {
        checkoutUrl?: string;
      };
      return { ok: response.ok, checkoutUrl: answer.checkoutUrl };
    },
  });
}

export function usePublishProof() {
  return useMutation({
    mutationFn: async (paperId: string) => {
      const response = await fetch("/api/proof-share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperId }),
      });
      if (response.status === 401) {
        return { unauthorized: true as const };
      }
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { slug?: string };
      return { unauthorized: false as const, slug: body.slug };
    },
  });
}

export function useUnpublishProof() {
  return useMutation({
    mutationFn: async (paperId: string) => {
      const response = await fetch("/api/proof-share", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperId }),
      });
      if (response.status === 401) {
        return { unauthorized: true as const };
      }
      if (!response.ok) throw new Error(String(response.status));
      return { unauthorized: false as const };
    },
  });
}

export function usePaperPhoto() {
  return useMutation({
    mutationFn: async (input: {
      paperId: string;
      body?: Blob;
      method: "PUT" | "DELETE";
    }) => {
      const response = await fetch(
        `/api/paper-photo?paperId=${encodeURIComponent(input.paperId)}`,
        input.method === "PUT"
          ? {
              method: "PUT",
              headers: { "content-type": "image/jpeg" },
              body: input.body,
            }
          : { method: "DELETE" },
      );
      if (input.method === "PUT" && !response.ok) {
        throw new Error(String(response.status));
      }
    },
  });
}

export function usePaperFile() {
  return useMutation({
    mutationFn: async (input: {
      uploadId: string;
      method: "PUT" | "DELETE";
      body?: File;
      contentType?: string;
      fileName?: string;
    }) => {
      const response = await fetch(
        `/api/paper-file?uploadId=${encodeURIComponent(input.uploadId)}`,
        input.method === "PUT"
          ? {
              method: "PUT",
              headers: {
                "content-type": input.contentType || "application/pdf",
                ...(input.fileName ? { "x-file-name": input.fileName } : {}),
              },
              body: input.body,
            }
          : { method: "DELETE" },
      );
      return { ok: response.ok, status: response.status };
    },
  });
}

export function useAuthSession() {
  return useMutation({
    mutationFn: async (input: {
      mode: "sign-in" | "sign-up";
      username: string;
      password: string;
    }) => {
      const response = await fetch(`/api/auth/${input.mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: input.username,
          password: input.password,
        }),
      });
      const payload = (await response.json()) as { ok: boolean; code?: string };
      return { ok: response.ok && payload.ok, code: payload.code };
    },
  });
}
