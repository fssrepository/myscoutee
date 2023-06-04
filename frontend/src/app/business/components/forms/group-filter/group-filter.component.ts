import { HttpParams } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { HttpService } from 'src/app/services/http.service';

interface Option {
  value: string;
  viewValue: string;
}

// distance bar also, not just calendar bar

@Component({
  selector: 'app-group-filter',
  templateUrl: './group-filter.component.html',
})
export class GroupFilterComponent implements OnInit {
  formGroup: FormGroup;

  progress: any = { mode: 'determine', value: 0, color: 'primary' };

  url: any;

  key: any;

  setting: any;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<GroupFilterComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private activatedRoute: ActivatedRoute,
    private httpService: HttpService
  ) {
    this.url = '/user/settings';

    let actionUrl = this.activatedRoute['_routerState'].snapshot.url.replace(
      '/base',
      ''
    );

    actionUrl = actionUrl.substring(1);
    this.key = actionUrl.substring(actionUrl.indexOf('/'));
  }

  onData(key, evt): void {
    this.formGroup.controls[key].setValue(evt.value);
  }

  ngOnInit(): void {
    let params = new HttpParams();
    params = params.set('key', this.key);

    this.httpService.get(this.url, params).subscribe({
      next: (result) => {
        let formGroup = new FormGroup({});

        this.setting = result;
        this.setting.items.map((item) => {
          switch (item.type) {
            case 'os':
              formGroup.addControl(item.name, new FormControl([...item.data]));
            default:
          }
        });

        this.formGroup = formGroup;
      },
      error: (error) => {
        this.progress.mode = 'determine';
        this.progress.color = 'warn';
      },
      complete: () => {
        console.log('complete');
      },
    });
  }

  onClick(): void {
    if (this.formGroup.valid) {
      let raw = this.formGroup.getRawValue();

      let items = this.setting.items.map((item) => {
        if (raw[item.name] instanceof Array) {
          item.data = [...raw[item.name]];
        } else {
          item.data = [raw[item.name]];
        }
        return item;
      });

      this.setting.items = items;

      let params = new HttpParams();
      params = params.set('key', this.key);

      this.httpService.save(this.url, this.setting, params).subscribe({
        next: (result) => {
          this.dialogRef.close(result['items']);
        },
        error: (error) => {
          this.progress.mode = 'determine';
          this.progress.color = 'warn';
        },
        complete: () => {
          this.progress.mode = 'determine';
        },
      });
    }
  }

  back(): void {
    this.dialogRef.close();
  }
}
