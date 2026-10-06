export class SurveyAnswerDto {
  menu_id: number;
  option_id: number;
}

export class CreateSurveyDto {
  name: string;
  phoneNumber: string;
  dateVisit?: string;
  usedToVisit: boolean;
  message?: string;
  answers: SurveyAnswerDto[];
}
