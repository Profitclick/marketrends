import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return <main><h1>Marketrends A01 feasibility</h1></main>
}
