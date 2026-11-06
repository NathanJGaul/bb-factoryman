import { describeStoreContract } from "../../test/store-contract";
import { createMemoryStore } from "./memory";

describeStoreContract("memory", () => createMemoryStore());
