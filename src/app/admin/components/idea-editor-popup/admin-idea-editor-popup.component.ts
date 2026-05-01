import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { IdeaPostsService, type IdeaPost, type IdeaPostSaveRequest } from '../../../shared/core';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { AdminService } from '../../admin.service';

type IdeaEditorMode = 'html' | 'preview';

interface IdeaPostDraft {
  id: string | null;
  title: string;
  excerpt: string;
  contentHtml: string;
  imageUrl: string;
  imageUrls: string[];
  featured: boolean;
  published: boolean;
  submittedAtLocal: string;
  mode: IdeaEditorMode;
}

@Component({
  selector: 'app-admin-idea-editor-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './admin-idea-editor-popup.component.html',
  styleUrl: './admin-idea-editor-popup.component.scss'
})
export class AdminIdeaEditorPopupComponent {
  protected readonly admin = inject(AdminService);
  private readonly ideaPosts = inject(IdeaPostsService);
  private readonly confirmationDialog = inject(ConfirmationDialogService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  protected loading = false;
  protected saving = false;
  protected uploading = false;
  protected error = '';
  protected copiedImageUrl = '';
  protected editing = false;
  protected draft: IdeaPostDraft | null = null;
  protected selectedPostId = '';
  private stateLoadedForPopup = false;

  constructor() {
    effect(() => {
      if (this.admin.activePopup() !== 'idea-editor') {
        this.stateLoadedForPopup = false;
        this.editing = false;
        this.draft = null;
        this.error = '';
        this.copiedImageUrl = '';
        return;
      }
      if (!this.stateLoadedForPopup) {
        this.stateLoadedForPopup = true;
        void this.load();
      }
    });
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (this.admin.activePopup() !== 'idea-editor') {
      return;
    }
    event.preventDefault();
    if (this.editing) {
      this.cancelEditing();
      return;
    }
    this.close();
  }

  protected posts(): IdeaPost[] {
    return this.ideaPosts.adminPosts();
  }

  protected selectedPost(): IdeaPost | null {
    const posts = this.posts();
    return posts.find(post => post.id === this.selectedPostId) ?? posts[0] ?? null;
  }

  protected async load(): Promise<void> {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.error = '';
    this.refreshView();
    try {
      const posts = await this.ideaPosts.loadAdminPosts(this.actorUserId());
      this.selectedPostId = posts[0]?.id ?? '';
    } catch {
      this.error = 'Unable to load idea posts.';
    } finally {
      this.loading = false;
      this.refreshView();
    }
  }

  protected close(): void {
    this.editing = false;
    this.draft = null;
    this.admin.closePopup();
  }

  protected selectPost(post: IdeaPost, event?: Event): void {
    event?.stopPropagation();
    this.selectedPostId = post.id;
  }

  protected startNew(event?: Event): void {
    event?.stopPropagation();
    this.beginEditing({
      id: null,
      title: '',
      excerpt: '',
      contentHtml: '<p>Describe why this MyScoutee idea matters.</p>',
      imageUrl: '',
      imageUrls: [],
      featured: false,
      published: true,
      submittedAtLocal: this.toDateTimeLocal(new Date().toISOString()),
      mode: 'html'
    });
  }

  protected startEditing(post: IdeaPost, event?: Event): void {
    event?.stopPropagation();
    this.selectedPostId = post.id;
    this.beginEditing({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt,
      contentHtml: this.formatHtmlFragment(post.contentHtml),
      imageUrl: post.imageUrl,
      imageUrls: [...post.imageUrls],
      featured: post.featured,
      published: post.published,
      submittedAtLocal: this.toDateTimeLocal(post.submittedAtIso || post.updatedAtIso || post.createdAtIso),
      mode: 'html'
    });
  }

  protected cancelEditing(event?: Event): void {
    event?.stopPropagation();
    this.editing = false;
    this.draft = null;
    this.copiedImageUrl = '';
  }

  protected toggleDraftMode(event?: Event): void {
    event?.stopPropagation();
    if (!this.draft) {
      return;
    }
    this.draft.mode = this.draft.mode === 'html' ? 'preview' : 'html';
  }

  protected async saveDraft(event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.draft || this.saving) {
      return;
    }
    const request: IdeaPostSaveRequest = {
      actorUserId: this.actorUserId(),
      id: this.draft.id,
      title: this.draft.title,
      excerpt: this.draft.excerpt,
      contentHtml: this.draft.contentHtml,
      imageUrl: this.draft.imageUrl,
      imageUrls: this.draft.imageUrls,
      featured: this.draft.featured,
      published: this.draft.published,
      submittedAtIso: this.fromDateTimeLocal(this.draft.submittedAtLocal)
    };
    this.saving = true;
    this.error = '';
    this.refreshView();
    try {
      const saved = await this.ideaPosts.savePost(request);
      this.selectedPostId = saved.id;
      this.editing = false;
      this.draft = null;
    } catch {
      this.error = 'Unable to save idea post.';
    } finally {
      this.saving = false;
      this.refreshView();
    }
  }

  protected deletePost(post: IdeaPost, event?: Event): void {
    event?.stopPropagation();
    this.confirmationDialog.open({
      title: 'Delete idea post?',
      message: post.title,
      confirmLabel: 'Delete',
      busyConfirmLabel: 'Deleting...',
      confirmTone: 'danger',
      onConfirm: async () => {
        this.saving = true;
        this.error = '';
        this.refreshView();
        try {
          const posts = await this.ideaPosts.deletePost(post.id, this.actorUserId());
          this.selectedPostId = posts[0]?.id ?? '';
        } catch {
          this.error = 'Unable to delete idea post.';
        } finally {
          this.saving = false;
          this.refreshView();
        }
      }
    });
  }

  protected async uploadDraftImage(event: Event): Promise<void> {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.[0] ?? null;
    if (!file || !this.draft || this.uploading) {
      return;
    }
    this.uploading = true;
    this.error = '';
    this.refreshView();
    try {
      const result = await this.ideaPosts.uploadImage(this.actorUserId(), this.draft.id || 'draft-idea', file);
      if (!result.uploaded || !result.imageUrl) {
        this.error = 'Image upload did not return a link.';
        return;
      }
      this.draft.imageUrls = this.uniqueImageUrls([result.imageUrl, ...this.draft.imageUrls]);
      if (!this.draft.imageUrl.trim()) {
        this.draft.imageUrl = result.imageUrl;
      }
      await this.copyImageLink(result.imageUrl);
    } catch {
      this.error = 'Unable to upload image.';
    } finally {
      this.uploading = false;
      if (input) {
        input.value = '';
      }
      this.refreshView();
    }
  }

  protected removeDraftImage(imageUrl: string, event?: Event): void {
    event?.stopPropagation();
    if (!this.draft) {
      return;
    }
    const normalized = imageUrl.trim();
    this.draft.imageUrls = this.draft.imageUrls.filter(url => url !== normalized);
    if (this.draft.imageUrl.trim() === normalized) {
      this.draft.imageUrl = this.draft.imageUrls[0] ?? '';
    }
  }

  protected setPrimaryImage(imageUrl: string, event?: Event): void {
    event?.stopPropagation();
    if (!this.draft) {
      return;
    }
    this.draft.imageUrl = imageUrl.trim();
    this.draft.imageUrls = this.uniqueImageUrls([this.draft.imageUrl, ...this.draft.imageUrls]);
  }

  protected async copyImageLink(imageUrl: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    const link = this.copyableImageLink(imageUrl);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        this.copyWithFallback(link);
      }
      this.copiedImageUrl = imageUrl;
    } catch {
      this.copyWithFallback(link);
      this.copiedImageUrl = imageUrl;
    }
  }

  protected formatPastedHtml(event: ClipboardEvent): void {
    if (!this.draft) {
      return;
    }
    const pasted = event.clipboardData?.getData('text/html')
      || event.clipboardData?.getData('text/plain')
      || '';
    if (!pasted.trim()) {
      return;
    }
    event.preventDefault();
    const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null;
    const current = this.draft.contentHtml ?? '';
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? start;
    this.draft.contentHtml = this.formatHtmlFragment(`${current.slice(0, start)}${pasted}${current.slice(end)}`);
  }

  protected copyableImageLink(imageUrl: string): string {
    const normalized = imageUrl.trim();
    if (!normalized || normalized.startsWith('data:')) {
      return normalized;
    }
    if (/^https?:\/\//i.test(normalized)) {
      return normalized;
    }
    if (typeof window === 'undefined') {
      return normalized;
    }
    return new URL(normalized, window.location.origin).toString();
  }

  protected postStatusLabel(post: IdeaPost): string {
    if (!post.published) {
      return 'Draft';
    }
    return post.featured ? 'Featured' : 'Published';
  }

  protected postDateLabel(post: Pick<IdeaPost, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'> | null): string {
    const parsed = Date.parse(post?.submittedAtIso || post?.updatedAtIso || post?.createdAtIso || '');
    if (!Number.isFinite(parsed)) {
      return 'No date';
    }
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(parsed));
  }

  protected draftImageUrl(): string {
    return `${this.draft?.imageUrl ?? this.draft?.imageUrls?.[0] ?? ''}`.trim();
  }

  protected actorUserId(): string {
    return this.admin.activeAdmin()?.id?.trim() || 'admin';
  }

  private beginEditing(draft: IdeaPostDraft): void {
    this.draft = draft;
    this.editing = true;
    this.copiedImageUrl = '';
  }

  private uniqueImageUrls(urls: readonly string[]): string[] {
    return Array.from(new Set(urls.map(url => `${url ?? ''}`.trim()).filter(Boolean)));
  }

  private toDateTimeLocal(value: string): string {
    const parsed = Date.parse(value);
    const date = Number.isFinite(parsed) ? new Date(parsed) : new Date();
    const pad = (next: number) => `${next}`.padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private fromDateTimeLocal(value: string): string {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  }

  private copyWithFallback(value: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  private refreshView(): void {
    queueMicrotask(() => {
      try {
        this.changeDetectorRef.detectChanges();
      } catch {
        // The popup may have been closed before the async demo request completed.
      }
    });
  }

  private formatHtmlFragment(value: string): string {
    const html = `${value ?? ''}`.trim();
    if (!html || typeof document === 'undefined') {
      return html;
    }
    const template = document.createElement('template');
    template.innerHTML = html;
    return Array.from(template.content.childNodes)
      .map(node => this.formatHtmlNode(node, 0))
      .flat()
      .filter(line => line.trim())
      .join('\n')
      .trim();
  }

  private formatHtmlNode(node: ChildNode, depth: number): string[] {
    const indent = '  '.repeat(depth);
    if (node.nodeType === 3) {
      const text = `${node.textContent ?? ''}`.replace(/\s+/g, ' ').trim();
      return text ? [`${indent}${this.escapeHtml(text)}`] : [];
    }
    if (!(node instanceof HTMLElement)) {
      return [];
    }
    const tag = node.tagName.toLowerCase();
    const attributes = Array.from(node.attributes)
      .map(attribute => ` ${attribute.name}="${this.escapeHtmlAttribute(attribute.value)}"`)
      .join('');
    const children = Array.from(node.childNodes).filter(child => child.nodeType !== 3 || `${child.textContent ?? ''}`.trim());
    if (['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(tag)) {
      return [`${indent}<${tag}${attributes}>`];
    }
    if (children.length === 0) {
      return [`${indent}<${tag}${attributes}></${tag}>`];
    }
    if (children.length === 1 && children[0].nodeType === 3) {
      const text = `${children[0].textContent ?? ''}`.replace(/\s+/g, ' ').trim();
      return [`${indent}<${tag}${attributes}>${this.escapeHtml(text)}</${tag}>`];
    }
    return [
      `${indent}<${tag}${attributes}>`,
      ...children.flatMap(child => this.formatHtmlNode(child, depth + 1)),
      `${indent}</${tag}>`
    ];
  }

  private escapeHtml(value: string): string {
    return `${value ?? ''}`
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private escapeHtmlAttribute(value: string): string {
    return this.escapeHtml(value).replace(/"/g, '&quot;');
  }
}
