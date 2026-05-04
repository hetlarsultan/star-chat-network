import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Deep chainable mock
const chainable = (resolveValue: any = null): any => {
  const fn: any = () => chainable(resolveValue);
  fn.select = () => chainable(resolveValue);
  fn.eq = () => chainable(resolveValue);
  fn.neq = () => chainable(resolveValue);
  fn.in = () => chainable(resolveValue);
  fn.or = () => chainable(resolveValue);
  fn.order = () => chainable(resolveValue);
  fn.limit = () => Promise.resolve({ data: [], count: 0 });
  fn.maybeSingle = () => Promise.resolve({ data: null, count: 0 });
  fn.single = () => Promise.resolve({ data: null, count: 0 });
  fn.insert = () => Promise.resolve({ data: null });
  fn.update = () => chainable(resolveValue);
  fn.delete = () => chainable(resolveValue);
  fn.then = (cb: any) => Promise.resolve({ data: [], count: 0 }).then(cb);
  return fn;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => chainable(),
    rpc: () => Promise.resolve({ data: null }),
    channel: () => ({
      on: function () { return this; },
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
  it("renders the public chat header", () => {
    render(<MemoryRouter><Rooms /></MemoryRouter>);
    expect(screen.getByText("الدردشة العامة")).toBeInTheDocument();
  });

  it("renders messages container with WhatsApp scroll class", () => {
    render(<MemoryRouter><Rooms /></MemoryRouter>);
    const container = screen.getByTestId("messages-container");
    expect(container).toBeInTheDocument();
    expect(container.className).toContain("chat-scroll-whatsapp");
  });

  it("renders test messages button", () => {
    render(<MemoryRouter><Rooms /></MemoryRouter>);
    expect(screen.getByText(/إضافة 20 رسالة تجريبية/)).toBeInTheDocument();
  });
});

describe("Profile Page", () => {
  it("renders the profile page", () => {
    render(<MemoryRouter><Profile /></MemoryRouter>);
    expect(screen.getByText(/الملف الشخصي|تعديل/)).toBeInTheDocument();
  });
});
