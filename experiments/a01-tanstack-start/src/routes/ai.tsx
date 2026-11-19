import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/ai')({
  component: Ai,
})

function Ai() {
  return <main><h1>Kunstig intelligens</h1></main>
}
