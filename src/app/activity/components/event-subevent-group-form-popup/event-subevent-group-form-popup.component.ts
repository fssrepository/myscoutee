
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

interface GroupFormModel {
  name: string;
  capacityMin: number;
  capacityMax: number;
}

@Component({
  selector: 'app-event-subevent-group-form-popup',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: './event-subevent-group-form-popup.component.html',
  styleUrls: ['./event-subevent-group-form-popup.component.scss']
})
export class EventSubeventGroupFormPopupComponent {
  @Input() open = false;
  @Input() title = 'Create Group';
  @Input() stageTitle = '';
  @Input() canSave = false;
  @Input() invalidName = false;
  @Input() model: GroupFormModel = {
    name: '',
    capacityMin: 4,
    capacityMax: 7
  };

  @Output() readonly save = new EventEmitter<Event>();
  @Output() readonly cancel = new EventEmitter<Event>();
  @Output() readonly capacityMinChange = new EventEmitter<number | string>();
  @Output() readonly capacityMaxChange = new EventEmitter<number | string>();
}
