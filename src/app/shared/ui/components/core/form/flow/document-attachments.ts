import { signal } from '@angular/core';
import type { MediaService } from '../../../../../core/base/services/media.service';
import type { DocumentAttachment } from '../../../../../core/contracts/document-attachment.interface';
import type { FormFlowStepModel, FormFlowActionEvent } from '@myscoutee/components';

/** Shared document block used by announcement and campaign editors. */
export class DocumentAttachments {
  readonly uploading = signal(false);
  readonly error = signal('');
  private generation = 0;
  constructor(private readonly media: MediaService, private readonly context: {
    files: () => DocumentAttachment[]; setFiles: (files: DocumentAttachment[]) => void;
    ownerId: () => string; entityId: () => string; readOnly: () => boolean; busy: () => boolean;
  }) {}
  reset(): void { this.generation++; this.uploading.set(false); this.error.set(''); }
  steps(t: (key: string) => string): FormFlowStepModel[] {
    const files=this.context.files(), readOnly=this.context.readOnly(), busy=this.uploading()||this.context.busy();
    if(readOnly&&!files.length)return [];
    return [{id:'attachments',title:t('announcement.attachments'),icon:'attach_file',
      headerControl:readOnly?null:{id:'attach',kind:'menu',config:{kind:'inline',items:[
        {id:'attach',icon:'add',ariaLabel:'announcement.attach',palette:'green',disabled:busy||files.length>=10},
        ...(files.length?[{id:'attachments-menu',icon:'more_vert',ariaLabel:'announcement.attachments',kind:'branch' as const,palette:'blue' as const,
          disabled:busy,items:files.map((file,index)=>({id:`attachment-${index}`,label:file.name,icon:'description',context:index,
            removable:true,removeIcon:'close',removeAriaLabel:'remove',closeOnSelect:false,surface:'tinted' as const,palette:'blue' as const}))}]:[])]}},
      controls:readOnly?[{id:'attachment-files',guideFieldId:'attachments',kind:'table',layout:'wide',
        config:{rows:files.map((file,index)=>({id:`attachment-${index}`,label:file.name,value:'',actions:[{id:'download',icon:'download',ariaLabel:'download',palette:'blue' as const,context:index}]}))}}]
        :[{id:'attachment-names',bind:'attachmentNames',guideFieldId:'attachments',kind:'text',layout:'wide',readOnly:true,placeholder:t('announcement.attachments.empty')}]}];
  }
  action(event:FormFlowActionEvent,input:HTMLInputElement):void {
    const action=event.sourceEvent.id, blocked=this.context.readOnly()||this.uploading()||this.context.busy();
    if(action==='attach'){if(!blocked)input.click();return;}
    const index=Number(event.context),files=this.context.files(),file=files[index];
    if(!Number.isInteger(index)||!file)return;
    if(event.sourceEvent.action==='remove'){if(!blocked)this.context.setFiles(files.filter((_,i)=>i!==index));}
    else if(action==='download'||action.startsWith('attachment-'))void this.download(file);
  }
  async upload(event:Event):Promise<void> {
    const input=event.target as HTMLInputElement,files=Array.from(input.files??[]);input.value='';
    if(this.uploading()||this.context.readOnly()||this.context.busy())return;
    const generation=this.generation;this.uploading.set(true);this.error.set('');
    try {
      if(files.length+this.context.files().length>10)throw new Error();
      for(const file of files){
        const result=await this.media.uploadDocument(this.context.ownerId(),this.context.entityId(),file);
        if(generation!==this.generation)return;
        if(!result.uploaded||!result.url)throw new Error();
        this.context.setFiles([...this.context.files(),{name:file.name,url:result.url,mimeType:file.type,sizeBytes:file.size}]);
      }
    }catch{if(generation===this.generation)this.error.set('announcement.attachment.failed');}
    finally{if(generation===this.generation)this.uploading.set(false);}
  }
  private async download(file:DocumentAttachment):Promise<void>{
    const generation=this.generation;
    try{await this.media.downloadDocument(file.url,file.name);}catch{if(generation===this.generation)this.error.set('announcement.attachment.failed');}
  }
}
