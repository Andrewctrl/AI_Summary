// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed(),
    }),
    chats: i.entity({
      title: i.string(),
      sourceType: i.string(),       // "mp4" | "txt" | "image"
      createdAt: i.date().indexed(),
    }),
    outputs: i.entity({
      type: i.string(),             // "summary" | "quiz" | "flashcards"
      content: i.json(),            // full Gemini response
      createdAt: i.date(),
    }),
  },
  links: {
    chatUser: {
      forward: { on: 'chats', has: 'one', label: '$user' },
      reverse: { on: '$users', has: 'many', label: 'chats' },
    },
    outputChat: {
      forward: { on: 'outputs', has: 'one', label: 'chat' },
      reverse: { on: 'chats', has: 'many', label: 'outputs' },
    },
  },
});

// This helps TypeScript display nicer intellisense
export type AppSchema = typeof schema;

export default schema;
