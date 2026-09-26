import { Compass } from 'lucide-react'
import { ButtonLink } from '../components/ui/Button'
import { EmptyState } from '../components/ui/bits'

export default function NotFound({ what = 'page', standalone = false }: { what?: string; standalone?: boolean }) {
  const body = (
    <EmptyState
      icon={<Compass size={22} />}
      title={`That ${what} doesn’t exist`}
      body="It may have been deleted, or the link is out of date."
      action={
        <ButtonLink to={standalone ? '/' : '/app'} variant="primary">
          {standalone ? 'Go home' : 'Back to classes'}
        </ButtonLink>
      }
    />
  )
  if (!standalone) return body
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="ambient" aria-hidden />
      <div className="relative w-full max-w-md">{body}</div>
    </div>
  )
}
