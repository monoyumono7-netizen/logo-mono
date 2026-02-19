function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForPostVisible(pathname: string): Promise<boolean> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(pathname, {
      method: 'GET',
      cache: 'no-store'
    }).catch(() => null);

    if (response?.ok) {
      return true;
    }

    await sleep(1500);
  }

  return false;
}
