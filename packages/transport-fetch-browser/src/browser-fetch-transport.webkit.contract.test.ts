// Copyright © 2026 Mcont.

import { defineTransportContract } from "../../testing/src/transport-contract.js";

import { createBrowserFetchTransportContractFixture } from "./browser-fetch-transport-contract-fixture.js";

/** Runs the shared Transport contract in WebKit. */
defineTransportContract("WebKit BrowserFetchTransport", createBrowserFetchTransportContractFixture);
