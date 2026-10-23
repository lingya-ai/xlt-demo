export function resolveConversationExecutionType(
  userMessage: {executionType?: string} | undefined,
  executionType?: string,
): string {
  return userMessage?.executionType ?? executionType ?? "USER_MESSAGE";
}
