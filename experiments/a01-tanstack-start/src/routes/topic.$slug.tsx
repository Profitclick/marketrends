import { createFileRoute } from '@tanstack/react-router'
import { requireKnownSlug } from '../lib/route-existence'

export const Route = createFileRoute('/topic/$slug')({
  loader: ({ params }) => requireKnownSlug('topic', params.slug),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <main><h1>Tema {data.slug}</h1></main>
}
