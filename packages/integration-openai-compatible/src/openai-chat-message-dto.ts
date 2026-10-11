// Copyright © 2026 Mcont.

import type { Extensions } from "@evolutos/mconet-core-domain";

import { requireObject, requireString, snapshotExtensions, unknownMembers } from "./wire.js";

/** Wire member that carries the role spelling. */
const messageRoleMember = "role";

/** Wire member that carries the message text. */
const messageContentMember = "content";

/** Members that belong to the frozen message shape and are not extensions. */
const knownMessageMembers: ReadonlySet<string> = new Set([messageRoleMember, messageContentMember]);

/** Name used when extension failures identify this wire value. */
const messageOwner = "OpenAIChatMessageDTO";

/**
 * Holds one `role` and `content` chat message exactly as it travels.
 *
 * `role` keeps the wire spelling and `content` keeps the text without trimming
 * or normalization. `extensions` holds members a response carried beyond the
 * frozen shape. They are captured for observation only and are never written
 * back, because the request profile forbids unknown members.
 */
export class OpenAIChatMessageDTO {
  /** Wire role spelling such as `system`, `user`, or `assistant`. */
  public readonly role: string;

  /** Message text exactly as sent or received. */
  public readonly content: string;

  /** Read-only response members outside the frozen message shape. */
  public readonly extensions: Extensions;

  /**
   * Creates one message from already separated role, text, and extensions.
   *
   * Role support is decided by the role mapping, not by this carrier. Both
   * wire fields are required strings, including the empty string.
   *
   * @param role Wire role spelling.
   * @param content Message text.
   * @param extensions Response members outside the frozen shape.
   */
  public constructor(role: string, content: string, extensions: Extensions = {}) {
    // Both fields are required and not nullable in the frozen profile.
    if (typeof role !== "string") {
      throw new TypeError(`${messageOwner} role must be a string.`);
    }
    if (typeof content !== "string") {
      throw new TypeError(`${messageOwner} content must be a string.`);
    }

    this.role = role;
    this.content = content;
    // Freeze a detached copy so later caller mutation cannot change the message.
    this.extensions = snapshotExtensions(extensions, messageOwner);
    Object.freeze(this);
  }

  /**
   * Returns the request message members in frozen profile order.
   *
   * Extensions are omitted: a request may contain only the frozen members,
   * whatever a previous response carried.
   *
   * @returns A new object containing only `role` and `content`.
   */
  public toJson(): { readonly role: string; readonly content: string } {
    return {
      role: this.role,
      content: this.content,
    };
  }

  /**
   * Reads one decoded message object.
   *
   * @param value Decoded JSON for the message.
   * @param path JSON Pointer of the message, used only in failure messages.
   * @returns The message with any unknown members captured as extensions.
   */
  public static fromJson(value: unknown, path = ""): OpenAIChatMessageDTO {
    const document = requireObject(value, path);
    const role = requireString(document, messageRoleMember, path);
    const content = requireString(document, messageContentMember, path);
    return new OpenAIChatMessageDTO(
      role,
      content,
      unknownMembers(document, knownMessageMembers, messageOwner),
    );
  }
}
