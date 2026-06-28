type CalLink = 'yosemitecrew/demo' | 'yosemitecrew/onboarding';

export const getCalEmbedUrl = (calLink: CalLink): string => {
  const params = new URLSearchParams({
    theme: 'light',
    layout: 'month_view',
    embedType: 'inline',
    embed: '30min',
  });

  return `https://app.cal.com/${calLink}/embed?${params.toString()}`;
};
