import { createFileRoute } from '@tanstack/react-router'
import { requireKnownSlug } from '../lib/route-existence'

export const Route = createFileRoute('/kategori/$slug')({
  loader: ({ params }) => requireKnownSlug('kategori', params.slug),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <main><h1>Kategori {data.slug}</h1></main>
}
