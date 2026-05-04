import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [] }),
          }),
          maybeSingle: () => Promise.resolve({ data: null }),
          single: () => Promise.resolve({ data: null }),
        }),
        in: () => Promise.resolve({ data: [] }),
        or: () => ({
          order: () => Promise.resolve({ data: [] }),
        }),
      }),
      insert: () => Promise.resolve({ data: null }),
      update: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null }),
          }),
        }),
      }),
    }),
    rpc: () => Promise.resolve({ data: null }),
    channel: () => ({
      on: () => ({
        on: () => ({ subscribe: () => ({}) }),
        subscribe: () => ({}),
      }),
      subscribe: () => ({}),
    }),
    removeChannel: () => {},
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://example.com/img.png" } }),
      }),
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

// Mock auth context
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", email: "test@test.com" },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

import Rooms from "@/pages/Rooms";
import Profile from "@/pages/Profile";

describe("Rooms Page", () => {
  it("renders the public chat header", async () => {
    render(
      <MemoryRouter>
        <Rooms />
      </MemoryRouter>
    );
    expect(screen.getByText("الدردشة العامة")).toBeInTheDocument();
  });

  it("renders messages container with WhatsApp scroll class", () => {
    render(
      <MemoryRouter>
        <Rooms />
      </MemoryRouter>
    );
    const container = screen.getByTestId("messages-container");
    expect(container).toBeInTheDocument();
    expect(container.className).toContain("chat-scroll-whatsapp");
  });

  it("renders test messages button", () => {
    render(
      <MemoryRouter>
        <Rooms />
      </MemoryRouter>
    );
    expect(screen.getByText(/إضافة 20 رسالة تجريبية/)).toBeInTheDocument();
  });
});

describe("Profile Page", () => {
  it("renders the profile page", () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );
    expect(screen.getByText(/الملف الشخصي|تعديل/)).toBeInTheDocument();
  });
});
