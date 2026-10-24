import { AppMenuDispatcher, type AppMenuDispatchConfig, type CardMenuRequestEvent, type InfoCardData } from '@fssrepository/myscoutee-components';

export function toggleInfoCardMenu(dispatcher: AppMenuDispatcher, id: string, request: CardMenuRequestEvent<InfoCardData>, content: () => Pick<AppMenuDispatchConfig, 'title' | 'items'>): void {
  if (dispatcher.isOpen(id)) {
    dispatcher.close(id);
    return;
  }
  dispatcher.open({ id, kind: 'select', ...content(), triggerRect: request.triggerRect, openUp: request.openUp, panelAlign: 'auto', closeOnSelect: true, onClose: request.closeTrigger }, null);
}
