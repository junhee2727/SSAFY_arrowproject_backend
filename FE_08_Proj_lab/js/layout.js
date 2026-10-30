export async function loadIncludes(root = document) {
  const targets = [...root.querySelectorAll("[data-include]")];

  await Promise.all(targets.map(async (target) => {
    const source = target.dataset.include;

    try {
      const response = await fetch(new URL(source, document.baseURI));
      if (!response.ok) {
        throw new Error(`${source} 파일을 불러오지 못했습니다. (HTTP ${response.status})`);
      }

      const template = document.createElement("template");
      template.innerHTML = await response.text();
      target.replaceWith(template.content);
    } catch (error) {
      console.error(error);
      target.remove();
    }
  }));
}
