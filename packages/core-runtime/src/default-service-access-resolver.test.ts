// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import {
  ModelInteractionError,
  type Authorization,
  type ResolvedServiceAccess,
  type ServiceAccess,
} from "@evolutos/mconet-core-domain";
import type { RuntimeComponent, ServiceAccessResolver } from "@evolutos/mconet-core-spi";

import {
  DefaultServiceAccessResolver,
  defaultServiceAccessResolverDescriptor,
} from "./default-service-access-resolver.js";

const interactionEndpoint = {
  kind: "absolute",
  value: "https://interaction.example.test/v1",
} as const;

const requestEndpoint = {
  kind: "absolute",
  value: "https://request.example.test/v1",
} as const;

const clientEndpoint = {
  kind: "absolute",
  value: "https://client.example.test/v1",
} as const;

const integrationEndpoint = {
  kind: "absolute",
  value: "https://integration.example.test/v1",
} as const;

/**
 * Builds one service-access layer with the required empty containers.
 *
 * @param partial Fields this layer explicitly contributes.
 * @returns A complete service-access input.
 */
function access(
  partial: Omit<Partial<ServiceAccess>, "headers" | "query" | "extensions"> &
    Partial<Pick<ServiceAccess, "headers" | "query" | "extensions">>,
): ServiceAccess {
  return {
    headers: [],
    query: [],
    extensions: {},
    ...partial,
  };
}

describe("DefaultServiceAccessResolver", () => {
  it("publishes builtin resolver metadata without a port contract", () => {
    const resolver = new DefaultServiceAccessResolver();

    // Every instance shares the diagnostic descriptor. Resolution is not a
    // capability and has no codec-style input or output port.
    expect(resolver.descriptor).toBe(defaultServiceAccessResolverDescriptor);
    expect(resolver.descriptor).toEqual({
      name: "default-service-access-resolver",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    });
    expect(resolver.descriptor.typeContract).toBeUndefined();
    expectTypeOf<DefaultServiceAccessResolver>().toMatchTypeOf<RuntimeComponent>();
    expectTypeOf<DefaultServiceAccessResolver>().toMatchTypeOf<ServiceAccessResolver>();
  });

  it("covers the field precedence matrix without merging authorization", () => {
    const resolver = new DefaultServiceAccessResolver();
    const interactionAuthorization = {
      kind: "authorization.interaction",
      scope: "interaction-only",
    };
    const requestAuthorization = {
      kind: "authorization.request",
      scope: "request-only",
    };
    const resolved = resolver.resolve({
      interactionOverride: access({
        authorization: interactionAuthorization,
        apiVersion: "",
        extensions: {
          shared: "interaction",
          vendor: { from: "interaction" },
        },
      }),
      requestAccess: access({
        endpoint: requestEndpoint,
        authorization: requestAuthorization,
        headers: [
          { name: "x-source", value: "request" },
          { name: "x-source", value: "request-repeat" },
        ],
        apiVersion: "request-version",
        projectId: "request-project",
        extensions: { shared: "request", requestOnly: true },
      }),
      clientDefault: access({
        endpoint: clientEndpoint,
        query: [{ name: "from", value: "client" }],
        projectId: "client-project",
        tenantId: "client-tenant",
        extensions: { shared: "client", clientOnly: "kept-only-if-selected" },
      }),
      integrationDefault: access({
        endpoint: integrationEndpoint,
        authorization: { kind: "authorization.integration" },
        headers: [{ name: "x-source", value: "integration" }],
        query: [{ name: "from", value: "integration" }],
        apiVersion: "integration-version",
        projectId: "integration-project",
        tenantId: "integration-tenant",
        extensions: { shared: "integration", integrationOnly: "no" },
      }),
    });

    // Each field independently selects the highest explicit layer. Empty
    // collections and omitted scalars fall through; empty strings do not.
    expect(resolved.endpoint).toEqual(requestEndpoint);
    expect(resolved.authorization).toEqual(interactionAuthorization);
    expect(resolved.authorization).not.toHaveProperty("scope", "request-only");
    expect(resolved.headers).toEqual([
      { name: "x-source", value: "request" },
      { name: "x-source", value: "request-repeat" },
    ]);
    expect(resolved.query).toEqual([{ name: "from", value: "client" }]);
    expect(resolved.apiVersion).toBe("");
    expect(resolved.projectId).toBe("request-project");
    expect(resolved.tenantId).toBe("client-tenant");
    expect(resolved.extensions).toEqual({
      shared: "interaction",
      vendor: { from: "interaction" },
    });
    expect(resolved.extensions).not.toHaveProperty("requestOnly");
    expect(resolved.extensions).not.toHaveProperty("clientOnly");
  });

  it("uses the only supplied layer when higher layers are omitted", () => {
    const resolver = new DefaultServiceAccessResolver();
    const resolved = resolver.resolve({
      integrationDefault: access({
        endpoint: integrationEndpoint,
        authorization: { kind: "authorization.none" },
        headers: [{ name: "x-integration", value: "yes" }],
        query: [{ name: "q", value: "integration" }],
        apiVersion: "integration-version",
        projectId: "integration-project",
        tenantId: "integration-tenant",
        extensions: { source: "integration" },
      }),
    });

    // Absence of a higher layer is omission, not an empty replacement layer.
    expect(resolved).toEqual({
      endpoint: integrationEndpoint,
      authorization: { kind: "authorization.none" },
      headers: [{ name: "x-integration", value: "yes" }],
      query: [{ name: "q", value: "integration" }],
      apiVersion: "integration-version",
      projectId: "integration-project",
      tenantId: "integration-tenant",
      extensions: { source: "integration" },
    });
  });

  it("falls through empty header query and extension containers", () => {
    const resolver = new DefaultServiceAccessResolver();
    const resolved = resolver.resolve({
      interactionOverride: access({
        endpoint: interactionEndpoint,
        authorization: { kind: "authorization.none" },
      }),
      clientDefault: access({
        headers: [{ name: "x-client", value: "kept" }],
        query: [{ name: "q", value: "kept" }],
        extensions: { source: "client" },
      }),
    });

    // Required empty containers mean this layer contributes no occurrences.
    // They must not erase a lower layer's non-sensitive context.
    expect(resolved.headers).toEqual([{ name: "x-client", value: "kept" }]);
    expect(resolved.query).toEqual([{ name: "q", value: "kept" }]);
    expect(resolved.extensions).toEqual({ source: "client" });
  });

  it("keeps optional provider context absent when every layer omits it", () => {
    const resolver = new DefaultServiceAccessResolver();
    const resolved = resolver.resolve({
      clientDefault: access({
        endpoint: clientEndpoint,
        authorization: { kind: "authorization.none" },
      }),
    });

    // A resolved snapshot distinguishes an omitted provider field from an
    // explicit empty string selected by a higher layer.
    expect(resolved).not.toHaveProperty("apiVersion");
    expect(resolved).not.toHaveProperty("projectId");
    expect(resolved).not.toHaveProperty("tenantId");
    expectTypeOf<ResolvedServiceAccess>().toMatchTypeOf<{
      readonly apiVersion?: string;
      readonly projectId?: string;
      readonly tenantId?: string;
    }>();
  });

  it("detaches the snapshot from later source mutation", () => {
    const resolver = new DefaultServiceAccessResolver();
    const headers = [{ name: "x-feature", value: "alpha" }];
    const extensions = { vendor: { region: "first" } };
    const authorization = { kind: "authorization.none", scope: "original" };
    const source = access({
      endpoint: { kind: "absolute", value: "https://client.example.test/v1" },
      authorization,
      headers,
      extensions,
    });

    const resolved = resolver.resolve({ clientDefault: source });
    headers.push({ name: "x-feature", value: "beta" });
    authorization.scope = "changed";
    extensions.vendor.region = "changed";

    // Resolution copies field values before returning, so the execution
    // snapshot stays at the values observed during the call.
    expect(source.headers).toHaveLength(2);
    expect(resolved.headers).toEqual([{ name: "x-feature", value: "alpha" }]);
    expect(resolved.authorization).toEqual({
      kind: "authorization.none",
      scope: "original",
    });
    expect(resolved.extensions).toEqual({ vendor: { region: "first" } });
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.headers)).toBe(true);
    expect(Object.isFrozen(resolved.headers[0])).toBe(true);
    expect(Object.isFrozen(resolved.query)).toBe(true);
    expect(Object.isFrozen(resolved.authorization)).toBe(true);
    expect(Object.isFrozen(resolved.extensions)).toBe(true);
    expect(Object.isFrozen(resolved.extensions.vendor)).toBe(true);
    expect(resolved.authorization).not.toBe(authorization);
  });

  it("does not read credential accessors while copying authorization", () => {
    const resolver = new DefaultServiceAccessResolver();
    let accessorReads = 0;
    let credentialReads = 0;
    const credentialSource = {
      getCredential() {
        credentialReads += 1;
        return "secret-credential";
      },
    };
    const authorization: Authorization = { kind: "authorization.bearer" };
    Object.defineProperty(authorization, "secret", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return "secret-credential";
      },
    });
    Object.defineProperty(authorization, "credentialSource", {
      enumerable: true,
      value: credentialSource,
      writable: false,
    });

    const resolved = resolver.resolve({
      requestAccess: access({
        endpoint: requestEndpoint,
        authorization,
      }),
    });

    // Support for a scheme may expose a credential source, but merging access
    // only copies that reference. Accessors are not authorization data.
    expect(accessorReads).toBe(0);
    expect(credentialReads).toBe(0);
    expect(resolved.authorization).not.toHaveProperty("secret");
    expect(resolved.authorization).toMatchObject({
      kind: "authorization.bearer",
      credentialSource,
    });
  });

  it("rejects an invalid lower layer even when a higher layer is complete", () => {
    const resolver = new DefaultServiceAccessResolver();
    const interaction = access({
      endpoint: interactionEndpoint,
      authorization: { kind: "authorization.none" },
      headers: [{ name: "x-safe", value: "visible" }],
    });
    const interactionSnapshot = structuredClone(interaction);

    expect(() =>
      resolver.resolve({
        interactionOverride: interaction,
        requestAccess: access({
          endpoint: { kind: "absolute", value: "ftp://request.example.test/v1" },
        }),
      }),
    ).toThrow(new TypeError("requestAccess must be a valid service access value."));
    expect(interaction).toEqual(interactionSnapshot);
  });

  it("reports incomplete access without copying supplied values into the error", () => {
    const resolver = new DefaultServiceAccessResolver();
    const secretHeader = "secret-header-value";
    const endpointValue = "https://client.example.test/secret-path";

    expect(() =>
      resolver.resolve({
        clientDefault: access({
          endpoint: { kind: "absolute", value: endpointValue },
          headers: [{ name: "x-secret", value: secretHeader }],
        }),
      }),
    ).toThrow(ModelInteractionError);

    try {
      resolver.resolve({
        clientDefault: access({
          endpoint: { kind: "absolute", value: endpointValue },
          headers: [{ name: "x-secret", value: secretHeader }],
        }),
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ModelInteractionError);
      if (!(error instanceof ModelInteractionError)) {
        return;
      }
      expect(error.category).toBe("invalid_request");
      expect(error.phase).toBe("resolution");
      expect(error.code).toBe("service_access_incomplete");
      expect(error.diagnostics).toEqual([
        {
          code: "service_access_incomplete",
          severity: "error",
          phase: "resolution",
          message: "Resolved service access is missing a required field.",
          details: {
            missingEndpoint: false,
            missingAuthorization: true,
          },
        },
      ]);
      const observed = `${error.message}\n${JSON.stringify(error.diagnostics)}`;
      expect(observed).not.toContain(secretHeader);
      expect(observed).not.toContain(endpointValue);
    }
  });

  it("keeps a proto extension member from becoming the result prototype", () => {
    const resolver = new DefaultServiceAccessResolver();
    const extensions = JSON.parse('{"__proto__":{"admin":true},"source":"client"}') as {
      source: string;
    };
    const resolved = resolver.resolve({
      clientDefault: access({
        endpoint: clientEndpoint,
        authorization: { kind: "authorization.none" },
        extensions,
      }),
    });

    // The member must survive as data. Defining it must not grant the resolved
    // map the nested object's properties through the prototype chain.
    expect(Object.getPrototypeOf(resolved.extensions)).toBeNull();
    expect(Object.getOwnPropertyDescriptor(resolved.extensions, "__proto__")?.value).toEqual({
      admin: true,
    });
    expect(resolved.extensions).not.toHaveProperty("admin");
    expect(resolved.extensions).toMatchObject({ source: "client" });
  });

  it("reports a missing endpoint separately from a missing authorization", () => {
    const resolver = new DefaultServiceAccessResolver();

    expect(() => resolver.resolve({})).toThrow(ModelInteractionError);
    try {
      resolver.resolve({
        integrationDefault: access({
          authorization: { kind: "authorization.none" },
        }),
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "service_access_incomplete",
        diagnostics: [
          {
            details: {
              missingEndpoint: true,
              missingAuthorization: false,
            },
          },
        ],
      });
    }
  });
});
