import { describe, it, expect } from "vitest";
import { parseLinkedIssueNumbers } from "@/lib/github";

describe("parseLinkedIssueNumbers", () => {
  it("returns [] for null input", () => {
    expect(parseLinkedIssueNumbers(null)).toEqual([]);
  });

  it("returns [] for undefined input", () => {
    expect(parseLinkedIssueNumbers(undefined)).toEqual([]);
  });

  it("returns [] for empty string", () => {
    expect(parseLinkedIssueNumbers("")).toEqual([]);
  });

  it.each([
    ["close", "close #1"],
    ["closes", "closes #2"],
    ["closed", "closed #3"],
    ["fix", "fix #4"],
    ["fixes", "fixes #5"],
    ["fixed", "fixed #6"],
    ["resolve", "resolve #7"],
    ["resolves", "resolves #8"],
    ["resolved", "resolved #9"],
  ])("matches keyword '%s'", (_keyword, body) => {
    const result = parseLinkedIssueNumbers(body);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeGreaterThan(0);
  });

  it("is case insensitive", () => {
    expect(parseLinkedIssueNumbers("FIXES #4")).toEqual([4]);
    expect(parseLinkedIssueNumbers("Closes #10")).toEqual([10]);
  });

  it("finds multiple issues in one body", () => {
    const body = "closes #1, fixes #2, and resolves #3";
    const result = parseLinkedIssueNumbers(body);
    expect(result).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(result).toHaveLength(3);
  });

  it("deduplicates issue numbers", () => {
    const body = "closes #5 fixes #5";
    expect(parseLinkedIssueNumbers(body)).toEqual([5]);
  });

  it("finds issues embedded in longer text", () => {
    const body =
      "This PR does a lot of things.\n\nIt closes #42 by refactoring the module.\nAlso fixes #99.";
    const result = parseLinkedIssueNumbers(body);
    expect(result).toEqual(expect.arrayContaining([42, 99]));
    expect(result).toHaveLength(2);
  });

  it("returns [] when # appears without a keyword", () => {
    expect(parseLinkedIssueNumbers("see #123 for details")).toEqual([]);
  });

  it("returns [] for non-matching partial keyword", () => {
    expect(parseLinkedIssueNumbers("fixe #10")).toEqual([]);
  });

  it("handles consecutive calls correctly (global regex lastIndex reset)", () => {
    const first = parseLinkedIssueNumbers("fixes #1");
    const second = parseLinkedIssueNumbers("fixes #2");
    expect(first).toEqual([1]);
    expect(second).toEqual([2]);
  });
});
