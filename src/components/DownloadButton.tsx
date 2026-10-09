import { IconDownload } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { ApiError, downloadFile } from '../api/client'

/** A download that says it's working and says when it failed - a click that
 *  quietly does nothing reads as "it worked" or as a broken page. */
export function DownloadButton({
  path,
  filename,
  children,
  primary,
}: {
  path: string
  filename: string
  children: ReactNode
  primary?: boolean
}) {
  const [state, setState] = useState<'idle' | 'working' | 'failed'>('idle')
  const [error, setError] = useState('')

  async function download() {
    setState('working')
    try {
      await downloadFile(path, filename)
      setState('idle')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not download the file')
      setState('failed')
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        className={primary ? 'btn btn--primary' : 'btn'}
        onClick={() => void download()}
        disabled={state === 'working'}
      >
        <IconDownload size={16} stroke={1.8} /> {state === 'working' ? 'Preparing…' : children}
      </button>
      {state === 'failed' && (
        <span role="alert" style={{ color: 'var(--coral)', fontSize: 12.5 }}>
          {error} —{' '}
          <button type="button" className="text-link" onClick={() => void download()}>
            Retry
          </button>
        </span>
      )}
    </span>
  )
}
