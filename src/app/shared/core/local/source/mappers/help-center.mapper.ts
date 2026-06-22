import type {
  HelpCenterAuditEntryDto,
  HelpCenterAuditAction,
  HelpCenterDocumentKind,
  HelpCenterHeaderColor,
  HelpCenterRevisionDto,
  HelpCenterSectionDto,
  HelpCenterSectionPanelSpan,
  PrivacyConsentSource,
  PrivacyConsentDto
} from '../../../contracts/content.interface';
import type {
  HelpCenterAuditRecord,
  HelpCenterRevisionRecord,
  HelpCenterSectionRecord,
  PrivacyConsentLocalRecord
} from '../entity/content.entity';
import { AppUtils } from '../../../../app-utils';
import { APP_STATIC_DATA } from '../../../../app-static-data';

export class LocalHelpCenterMapper {
  static toRevisionDTO(record: HelpCenterRevisionRecord): HelpCenterRevisionDto {
    return {
      id: record.id,
      documentKind: this.toDocumentKind(record.documentKind),
      contextKey: record.contextKey,
      lang: record.lang,
      languageLabel: record.languageLabel,
      version: record.version,
      title: record.title,
      summary: record.summary,
      description: record.description,
      headerColor: this.toHeaderColor(record.headerColor),
      sections: record.sections.map(section => this.toSectionDTO(section)),
      active: record.active,
      createdAtIso: record.createdAtIso,
      createdByUserId: record.createdByUserId,
      updatedAtIso: record.updatedAtIso,
      updatedByUserId: record.updatedByUserId
    };
  }

  static toRevisionRecord(dto: HelpCenterRevisionDto): HelpCenterRevisionRecord {
    return {
      id: dto.id,
      documentKind: dto.documentKind,
      contextKey: dto.contextKey,
      lang: dto.lang,
      languageLabel: dto.languageLabel,
      version: dto.version,
      title: dto.title,
      summary: dto.summary,
      description: dto.description,
      headerColor: dto.headerColor,
      sections: dto.sections.map(section => this.toSectionRecord(section)),
      active: dto.active,
      createdAtIso: dto.createdAtIso,
      createdByUserId: dto.createdByUserId,
      updatedAtIso: dto.updatedAtIso,
      updatedByUserId: dto.updatedByUserId
    };
  }

  static toAuditDTO(record: HelpCenterAuditRecord): HelpCenterAuditEntryDto {
    return {
      id: record.id,
      documentKind: this.toDocumentKind(record.documentKind),
      lang: record.lang,
      languageLabel: record.languageLabel,
      revisionId: record.revisionId,
      version: record.version,
      action: this.toAuditAction(record.action),
      actorUserId: record.actorUserId,
      createdAtIso: record.createdAtIso,
      message: record.message
    };
  }

  static toAuditRecord(dto: HelpCenterAuditEntryDto): HelpCenterAuditRecord {
    return {
      id: dto.id,
      documentKind: dto.documentKind,
      lang: dto.lang,
      languageLabel: dto.languageLabel,
      revisionId: dto.revisionId,
      version: dto.version,
      action: dto.action,
      actorUserId: dto.actorUserId,
      createdAtIso: dto.createdAtIso,
      message: dto.message
    };
  }

  static toPrivacyConsentDTO(record: PrivacyConsentLocalRecord): PrivacyConsentDto {
    return {
      id: record.id,
      userId: record.userId,
      revisionId: record.revisionId,
      revisionVersion: record.revisionVersion,
      approvedOptionalSectionIds: [...record.approvedOptionalSectionIds],
      acceptedAtIso: record.acceptedAtIso,
      updatedAtIso: record.updatedAtIso,
      source: this.toPrivacyConsentSource(record.source)
    };
  }

  static toPrivacyConsentRecord(dto: PrivacyConsentDto): PrivacyConsentLocalRecord {
    return {
      id: dto.id,
      userId: dto.userId,
      revisionId: dto.revisionId,
      revisionVersion: dto.revisionVersion,
      approvedOptionalSectionIds: [...dto.approvedOptionalSectionIds],
      acceptedAtIso: dto.acceptedAtIso,
      updatedAtIso: dto.updatedAtIso,
      source: dto.source
    };
  }

  private static toSectionDTO(record: HelpCenterSectionRecord): HelpCenterSectionDto {
    return {
      id: record.id,
      icon: record.icon,
      title: record.title,
      blurb: record.blurb,
      contentHtml: record.contentHtml,
      imageUrls: record.imageUrls ? [...record.imageUrls] : record.imageUrls,
      panelSpan: this.toSectionPanelSpan(record.panelSpan),
      optional: record.optional,
      details: record.details ? [...record.details] : record.details,
      points: record.points ? [...record.points] : record.points
    };
  }

  private static toSectionRecord(dto: HelpCenterSectionDto): HelpCenterSectionRecord {
    return {
      id: dto.id,
      icon: dto.icon,
      title: dto.title,
      blurb: dto.blurb,
      contentHtml: dto.contentHtml,
      imageUrls: dto.imageUrls ? [...dto.imageUrls] : dto.imageUrls,
      panelSpan: dto.panelSpan,
      optional: dto.optional,
      details: dto.details ? [...dto.details] : dto.details,
      points: dto.points ? [...dto.points] : dto.points
    };
  }

  private static toDocumentKind(value: string | null | undefined): HelpCenterDocumentKind | undefined {
    switch (`${value ?? ''}`.trim()) {
      case 'help':
      case 'privacy':
      case 'terms':
      case 'explanation':
        return value as HelpCenterDocumentKind;
      default:
        return undefined;
    }
  }

  private static toHeaderColor(value: string | null | undefined): HelpCenterHeaderColor | undefined {
    return AppUtils.enumValueOrNull(value, APP_STATIC_DATA.helpCenterHeaderColors) ?? undefined;
  }

  private static toSectionPanelSpan(value: string | null | undefined): HelpCenterSectionPanelSpan | undefined {
    switch (`${value ?? ''}`.trim()) {
      case 'span-1':
      case 'span-2':
      case 'span-3':
        return value as HelpCenterSectionPanelSpan;
      default:
        return undefined;
    }
  }

  private static toAuditAction(value: string | null | undefined): HelpCenterAuditAction {
    switch (`${value ?? ''}`.trim()) {
      case 'seed':
      case 'create':
      case 'update':
      case 'activate':
      case 'delete':
        return value as HelpCenterAuditAction;
      default:
        return 'update';
    }
  }

  private static toPrivacyConsentSource(value: string | null | undefined): PrivacyConsentSource {
    return `${value ?? ''}`.trim() === 'settings' ? 'settings' : 'entry';
  }
}
