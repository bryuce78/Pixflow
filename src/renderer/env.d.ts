interface Window {
  api?: {
    getServerPort: () => Promise<number>
    showNotification: (title: string, body: string) => void
    openPath: (filePath: string) => Promise<string>
  }
}
